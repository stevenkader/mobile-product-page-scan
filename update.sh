#!/bin/bash

# update.sh - Quick git add, commit, and push script
# Usage: ./update.sh "Your commit message"
# If no message provided, uses default message

# Check if commit message was provided
if [ -z "$1" ]; then
  COMMIT_MSG="Update: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "No commit message provided. Using: $COMMIT_MSG"
else
  COMMIT_MSG="$1"
fi

# Add all changes
echo "Adding all changes..."
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
  echo "No changes to commit."
  exit 0
fi

# Commit with message
echo "Committing changes..."
git commit -m "$COMMIT_MSG"

# Push to remote
echo "Pushing to remote..."
git push

echo "✓ Done! Changes pushed to GitHub."
