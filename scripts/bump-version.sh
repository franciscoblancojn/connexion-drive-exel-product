#!/usr/bin/env bash
set -e

if [ $# -ne 1 ] || [[ ! "$1" =~ ^(major|minor|patch)$ ]]; then
    echo "Uso: npm run push-v -- major|minor|patch"
    exit 1
fi

VERSION=$(grep -i "Version:" index.php | sed 's/.*Version:[[:space:]]*//')
MAJOR=$(echo "$VERSION" | cut -d. -f1)
MINOR=$(echo "$VERSION" | cut -d. -f2)
PATCH=$(echo "$VERSION" | cut -d. -f3)

case "$1" in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

sed -i "s/\(Version: *\)[0-9.]\+/\1$NEW_VERSION/" index.php

echo "✓ Versión: $VERSION → $NEW_VERSION"

npm run push-tag --silent 2>/dev/null || true
