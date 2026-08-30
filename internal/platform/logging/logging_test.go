package logging_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/chiempham/warp/internal/platform/logging"
)

// Warp stores and reasons in UTC everywhere. A log line in the machine's local
// zone breaks that exactly when it matters most: correlating an incident across
// the api and the worker.
func TestNew_logsTimestampsInUTC(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, &slog.HandlerOptions{
		ReplaceAttr: logging.UTCTimestamps,
	}))

	logger.Info("hello")

	var line struct {
		Time string `json:"time"`
	}
	if err := json.Unmarshal(buf.Bytes(), &line); err != nil {
		t.Fatalf("log line is not JSON: %v", err)
	}
	parsed, err := time.Parse(time.RFC3339Nano, line.Time)
	if err != nil {
		t.Fatalf("timestamp %q is not RFC 3339: %v", line.Time, err)
	}
	if _, offset := parsed.Zone(); offset != 0 {
		t.Errorf("timestamp %q carries a non-zero UTC offset", line.Time)
	}
	if !strings.HasSuffix(line.Time, "Z") {
		t.Errorf("timestamp %q should end in Z", line.Time)
	}
}

func TestFrom_returnsAUsableLoggerWhenNoneIsSet(t *testing.T) {
	// Handlers must not have to nil-check before logging.
	logging.From(t.Context()).Info("this must not panic")
}
