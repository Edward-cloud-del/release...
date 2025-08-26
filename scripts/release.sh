#!/bin/bash

# FrameSense Release Script
# Usage: ./scripts/release.sh [version]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if git is clean
check_git_status() {
    if [[ -n $(git status --porcelain) ]]; then
        print_error "Git working directory is not clean. Please commit or stash your changes."
        exit 1
    fi
    print_success "Git working directory is clean"
}

# Update version in files
update_version() {
    local version=$1
    print_status "Updating version to $version..."
    
    # Update package.json
    sed -i.bak "s/\"version\": \".*\"/\"version\": \"$version\"/" package.json
    rm package.json.bak
    
    # Update Cargo.toml
    sed -i.bak "s/version = \".*\"/version = \"$version\"/" src-tauri/Cargo.toml
    rm src-tauri/Cargo.toml.bak
    
    # Update tauri.conf.json
    sed -i.bak "s/\"version\": \".*\"/\"version\": \"$version\"/" src-tauri/tauri.conf.json
    rm src-tauri/tauri.conf.json.bak
    
    print_success "Version updated in all files"
}

# Create git tag
create_tag() {
    local version=$1
    print_status "Creating git tag v$version..."
    
    git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
    git commit -m "chore: bump version to $version"
    git tag -a "v$version" -m "Release v$version"
    
    print_success "Git tag v$version created"
}

# Push to remote
push_release() {
    local version=$1
    print_status "Pushing release to remote..."
    
    git push origin main
    git push origin "v$version"
    
    print_success "Release pushed to remote. GitHub Actions will handle the build and release."
}

# Main script
main() {
    local version=$1
    
    if [[ -z "$version" ]]; then
        print_error "Version is required. Usage: ./scripts/release.sh [version]"
        exit 1
    fi
    
    # Validate version format (semantic versioning)
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
        print_error "Invalid version format. Use semantic versioning (e.g., 1.0.0 or 1.0.0-beta)"
        exit 1
    fi
    
    print_status "Starting release process for version $version"
    
    # Run checks
    check_git_status
    
    # Update version
    update_version "$version"
    
    # Create tag
    create_tag "$version"
    
    # Push release
    push_release "$version"
    
    print_success "Release process completed! 🚀"
    print_status "Monitor the GitHub Actions workflow at: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/actions"
}

# Run main function with all arguments
main "$@"
