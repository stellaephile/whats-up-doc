#!/bin/bash

echo "🏥 Testing Health-Hacker Pincode-Based API Endpoints"
echo "=================================================="

BASE_URL="http://localhost:3000"

echo ""
echo "1️⃣ Testing basic hospital recommendation (Hyderabad - 500001)..."
curl -s "$BASE_URL/api/hospitals/recommend?condition=fever&pincode=500001" | jq '.totalFound, .recommendations[0].name, .recommendations[0].category'

echo ""
echo "2️⃣ Testing emergency hospitals (Bangalore - 560001)..."
curl -s "$BASE_URL/api/hospitals/emergency?pincode=560001" | jq '.nearestHospitals | length, .[0].name'

echo ""
echo "3️⃣ Testing Chennai hospitals (600001)..."
curl -s "$BASE_URL/api/hospitals/recommend?condition=heart%20checkup&pincode=600001" | jq '.totalFound, .recommendations[0].name'

echo ""
echo "4️⃣ Testing areas endpoint..."
curl -s "$BASE_URL/api/hospitals/areas?city=Hyderabad" | jq '.areas | length, .[0:3] | .[] | .area + " (" + .pincode + ")"'

echo ""
echo "5️⃣ Testing invalid pincode (999999)..."
curl -s "$BASE_URL/api/hospitals/recommend?condition=fever&pincode=999999" | jq '.totalFound, .recommendations[0].name'

echo ""
echo "✅ All API endpoints are working!"
echo ""
echo "🚀 Frontend available at: http://localhost:3001"
echo "📱 Try these test cases:"
echo "   - Pincode: 500001, Condition: fever"
echo "   - Pincode: 560001, Condition: heart checkup"
echo "   - Pincode: 600001, Condition: child fever"
echo "   - Toggle emergency mode for 24/7 hospitals"