package logs

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"time"
)

var (
	WarningLogger = log.New(os.Stdout, "WARNING: ", log.Ldate|log.Ltime|log.Lshortfile)
	InfoLogger    = log.New(os.Stdout, "INFO: ", log.Ldate|log.Ltime|log.Lshortfile)
	ErrorLogger   = log.New(os.Stderr, "ERROR: ", log.Ldate|log.Ltime|log.Lshortfile)
)

// Init writes each logger to a daily file in logDir as well as the console.
func Init(logDir string) error {
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return err
	}
	filename := time.Now().Format("2006-01-02")
	open := func(prefix string) (*os.File, error) {
		return os.OpenFile(filepath.Join(logDir, prefix+"log-"+filename+".txt"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0666)
	}

	infoFile, err := open("Info")
	if err != nil {
		return err
	}
	warningFile, err := open("Warning")
	if err != nil {
		return err
	}
	errorFile, err := open("Error")
	if err != nil {
		return err
	}

	InfoLogger.SetOutput(io.MultiWriter(os.Stdout, infoFile))
	WarningLogger.SetOutput(io.MultiWriter(os.Stdout, warningFile))
	ErrorLogger.SetOutput(io.MultiWriter(os.Stderr, errorFile))
	return nil
}
