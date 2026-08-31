package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/chiempham/warp-work/internal/store"
)

// ErrNoEmailFromProvider means the provider asserted an identity but no address
// to display it under. user_profiles.email is required, so there is nothing to
// create an account with.
var ErrNoEmailFromProvider = errors.New("sign-in provider returned no email address")

// StartGoogleSignIn returns where to send the browser, and the state that has
// to come back with it.
func (s *Service) StartGoogleSignIn(ctx context.Context, returnTo string) (string, FlowState, error) {
	if s.google == nil || !s.google.Configured() {
		return "", FlowState{}, ErrProviderNotConfigured
	}

	flow, err := NewFlowState(returnTo)
	if err != nil {
		return "", FlowState{}, err
	}

	url, err := s.google.AuthCodeURL(ctx, flow.State, flow.Nonce)
	if err != nil {
		return "", FlowState{}, err
	}
	return url, flow, nil
}

// CompleteGoogleSignIn finishes the dance and opens a session.
//
// Three outcomes, in order of preference:
//
//  1. The subject is already linked — sign in.
//  2. The subject is new but the provider vouches for an email that an existing
//     account uses — link this identity to that account. Only ever on a
//     *verified* email: matching on an unverified one would let anyone who can
//     claim an address at the provider take over the account.
//  3. Neither — create an account. Registration is unrestricted here, so
//     signing in with Google for the first time works without a separate
//     sign-up step. This is what makes the feature run on nothing but a client
//     id and secret.
//
// All of it happens in one transaction: an identity created without a session,
// or a user without a profile, is not a state worth being able to reach.
func (s *Service) CompleteGoogleSignIn(
	ctx context.Context,
	code, stateFromCallback string,
	flow FlowState,
	sc SignInContext,
) (Session, error) {
	if s.google == nil || !s.google.Configured() {
		return Session{}, ErrProviderNotConfigured
	}

	// Compared here rather than in the handler so the rule lives with the flow
	// it protects. Constant time is unnecessary: both values are ours and
	// single-use, and a mismatch reveals nothing about a secret.
	if flow.State == "" || stateFromCallback == "" || flow.State != stateFromCallback {
		return Session{}, ErrStateMismatch
	}

	identity, err := s.google.Verify(ctx, code, flow.Nonce)
	if err != nil {
		return Session{}, err
	}

	now := s.clock()
	var session Session

	err = s.store.InTx(ctx, func(repo Repository) error {
		provider, err := repo.ProviderByKindSubject(ctx, store.ProviderByKindSubjectParams{
			Kind:    store.AuthProviderKindGoogle,
			Subject: identity.Subject,
		})

		switch {
		case err == nil:
			// (1) Known identity.
			if markErr := repo.MarkProviderUsed(ctx, store.MarkProviderUsedParams{
				ID:          provider.ID,
				LastLoginAt: timestamp(now),
			}); markErr != nil {
				return fmt.Errorf("mark provider used: %w", markErr)
			}
			session, err = s.openSession(ctx, repo, provider.UserID, &provider.ID, now, sc)
			return err

		case !notFound(err):
			return fmt.Errorf("look up federated identity: %w", err)
		}

		if identity.Email == "" {
			return ErrNoEmailFromProvider
		}

		userID, err := s.resolveAccountFor(ctx, repo, identity)
		if err != nil {
			return err
		}

		providerID, err := uuid.NewV7()
		if err != nil {
			return fmt.Errorf("new provider id: %w", err)
		}

		email := identity.Email
		if _, err := repo.CreateAuthProvider(ctx, store.CreateAuthProviderParams{
			ID:        providerID,
			UserID:    userID,
			Kind:      store.AuthProviderKindGoogle,
			Subject:   identity.Subject,
			Email:     &email,
			IsPrimary: false,
		}); err != nil {
			return fmt.Errorf("link sign-in method: %w", err)
		}
		if err := repo.MarkProviderUsed(ctx, store.MarkProviderUsedParams{
			ID:          providerID,
			LastLoginAt: timestamp(now),
		}); err != nil {
			return fmt.Errorf("mark provider used: %w", err)
		}

		session, err = s.openSession(ctx, repo, userID, &providerID, now, sc)
		return err
	})
	if err != nil {
		return Session{}, err
	}

	return session, nil
}

// resolveAccountFor finds the account a new federated identity belongs to, or
// creates one.
func (s *Service) resolveAccountFor(ctx context.Context, repo Repository, identity Identity) (uuid.UUID, error) {
	if identity.EmailVerified {
		profile, err := repo.UserProfileByEmail(ctx, identity.Email)
		switch {
		case err == nil:
			// (2) Link to the account that already uses this address.
			return profile.UserID, nil
		case !notFound(err):
			return uuid.Nil, fmt.Errorf("look up profile by email: %w", err)
		}
	}

	// (3) New account.
	userID, err := uuid.NewV7()
	if err != nil {
		return uuid.Nil, fmt.Errorf("new user id: %w", err)
	}
	if _, err := repo.CreateUser(ctx, userID); err != nil {
		return uuid.Nil, fmt.Errorf("create user: %w", err)
	}
	if _, err := repo.CreateUserProfile(ctx, store.CreateUserProfileParams{
		UserID:      userID,
		Email:       identity.Email,
		DisplayName: displayNameFor(identity),
	}); err != nil {
		return uuid.Nil, fmt.Errorf("create profile: %w", err)
	}
	return userID, nil
}

// displayNameFor falls back to the local part of the address, because
// user_profiles.display_name is required and a provider may not return a name.
func displayNameFor(identity Identity) string {
	if name := strings.TrimSpace(identity.Name); name != "" {
		return name
	}
	if local, _, found := strings.Cut(identity.Email, "@"); found && local != "" {
		return local
	}
	return identity.Email
}
