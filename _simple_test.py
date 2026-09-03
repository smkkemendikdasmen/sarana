#!/usr/bin/env python3
import sys, os, datetime

TEST_OUT = "/Users/ilahilah/Documents/Project/PRISMA/saranasmk/_test_output.txt"
with open(TEST_OUT, "w") as f:
    f.write(f"Test script ran at {datetime.datetime.now()}\n")
    f.write(f"Python: {sys.executable} {sys.version}\n")
    f.write(f"cwd: {os.getcwd()}\n")
    f.write(f"argv: {sys.argv}\n")
    f.write(f"PID: {os.getpid()}\n")
    f.write(f"uid: {os.getuid()}\n")

    # Coba tulis juga ke /tmp
    try:
        with open("/tmp/_test_from_py.txt", "w") as f2:
            f2.write(f"Test from python at {datetime.datetime.now()}\n")
        f.write("OK: wrote /tmp/_test_from_py.txt\n")
    except Exception as e:
        f.write(f"FAIL: write /tmp/_test_from_py.txt: {e}\n")

    # Coba run shell command
    try:
        import subprocess
        r = subprocess.run(["echo", "SHELL_TEST_OK"], capture_output=True, text=True, timeout=5)
        f.write(f"subprocess echo: rc={r.returncode}, out={r.stdout.strip()}, err={r.stderr.strip()}\n")
    except Exception as e:
        f.write(f"subprocess FAIL: {e}\n")

    # Coba paramiko import
    try:
        import paramiko
        f.write(f"paramiko OK: {paramiko.__version__}\n")
    except Exception as e:
        f.write(f"paramiko FAIL: {e}\n")

f.close()
print(f"Wrote {TEST_OUT}")
sys.exit(0)
