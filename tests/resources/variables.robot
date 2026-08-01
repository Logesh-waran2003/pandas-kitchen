*** Variables ***
# ── Servers ──────────────────────────────────────────────────────────────────
${API_URL}              http://localhost:3001/api/v1
${CUSTOMER_URL}         http://localhost:3003
${ADMIN_URL}            http://localhost:3000

# ── Seed credentials ─────────────────────────────────────────────────────────
${STAFF_EMAIL}          admin@pandaskitchen.com
${STAFF_PASSWORD}       admin123
${RESTAURANT_SLUG}      pandas-kitchen
${BRANCH_ID}            main-branch
${COUPON_CODE}          WELCOME20

# ── Customer test data ────────────────────────────────────────────────────────
${CUST_PHONE}           9876543210
${CUST_NAME}            Test Customer

# ── Timeouts ─────────────────────────────────────────────────────────────────
${TIMEOUT}              10s
