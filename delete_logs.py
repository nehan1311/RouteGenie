import os
import glob

def delete_logs():
    # Find all files ending with .log in the current directory and its subdirectories
    log_files = glob.glob("**/*.log", recursive=True)
    deleted_count = 0

    print(f"Searching for log files in {os.getcwd()}...")
    for file_path in log_files:
        try:
            if os.path.isfile(file_path):
                os.remove(file_path)
                print(f"Deleted: {file_path}")
                deleted_count += 1
        except Exception as e:
            print(f"Failed to delete {file_path}: {e}")

    print(f"Done. Deleted {deleted_count} log files.")

if __name__ == "__main__":
    delete_logs()
