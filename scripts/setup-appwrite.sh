#!/bin/bash
# Appwrite Database Setup via REST API
# Run: chmod +x scripts/setup-appwrite.sh && ./scripts/setup-appwrite.sh

PROJECT_ID="69d9e24e0011cbc31ed4"
API_KEY="<YOUR_API_KEY>"  # Get from Appwrite Console → Settings → API Keys
ENDPOINT="https://fra.cloud.appwrite.io/v1"

echo "Setting up Appwrite database..."

# Create Database
echo "Creating database zimo..."
curl -s -X POST "$ENDPOINT/databases" \
  -H "Content-Type: application/json" \
  -H "X-Project-$PROJECT_ID: $API_KEY" \
  -d '{"name": "zimo", "databaseId": "zimo"}' || echo "Database may already exist"

# Create Collections
for coll in users posts messages notifications follows; do
  echo "Creating collection $coll..."
  curl -s -X POST "$ENDPOINT/databases/zimo/collections" \
    -H "Content-Type: application/json" \
    -H "X-Project-$PROJECT_ID: $API_KEY" \
    -d "{\"name\": \"$coll\", \"collectionId\": \"$coll\"}" || echo "Collection $coll may exist"
done

echo "Done! Add attributes manually in Appwrite Console."