#!/usr/bin/env python3
import os, sys
from pathlib import Path

test_file = Path("/Users/ilahilah/Documents/Project/PRISMA/saranasmk/_PYTHON_TEST_MARKER.txt")
print("PYTHON RUNNING TEST", flush=True)
print(f"PID = {os.getpid()}", flush=True)
print(f"CWD = {os.getcwd()}", flush=True)
print(f"Writing to: {test_file}", flush=True)

content = f"TEST AT {__import__('datetime').datetime.now()}\nPID={os.getpid()}\nCWD={os.getcwd()}\n"
test_file.parent.mkdir(parents=True, exist_ok=True)
with open(test_file, "w") as f:
    f.write(content)

print("WRITE DONE", flush=True)
sys.stderr.write("STDERR: OK\n")
sys.exit(0)
