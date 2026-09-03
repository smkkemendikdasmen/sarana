#!/usr/bin/env bash
set -e
echo "SIMPLE_SHELL_START_AT=$(date)"
echo "SIMPLE_TEST_CONTENT_$(date +%s) PID=$$" > /Users/ilahilah/Documents/Project/PRISMA/saranasmk/_SIMPLE_TEST_OUTPUT.txt
echo "FILE WRITTEN. Content:"
cat /Users/ilahilah/Documents/Project/PRISMA/saranasmk/_SIMPLE_TEST_OUTPUT.txt
echo "SIMPLE_SHELL_DONE"
