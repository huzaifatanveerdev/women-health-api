# Stripe Price ID Guide

## What is a Price ID?

A **Price ID** is a unique identifier in Stripe that represents a pricing plan for a subscription or one-time payment. It's linked to a **Product** and defines:

- The amount to charge
- The currency (USD, EUR, etc.)
- The billing interval (monthly, yearly, one-time)
- The billing model (per unit, flat rate, tiered, etc.)

**Format:** `price_ABC123xyz` (starts with `price_`)

---

## 🔗 Stripe Hierarchy: Product → Price → Subscription

```
Product (e.g., "Monthly Donation Plan")
  └─> Price (e.g., "$10/month")
      └─> Subscription (when user subscribes)
```

**Example:**
- **Product**: "women-help-api Donation Plan"
- **Price**: "$10 USD per month"
- **Price ID**: `price_1ABC123xyz789`
- **Subscription**: User subscribes to this price

---

## 📍 How to Get Price ID from Stripe Dashboard

### **Step 1: Create a Product (if you don't have one)**

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Products** → Click **"Add product"**
3. Fill in product details:
   - **Name**: "Monthly Donation Plan" (or any name)
   - **Description**: Optional description
   - **Pricing model**: Choose one:
     - **Standard pricing**: Fixed amount
     - **Per unit**: Price per unit
     - **Tiered pricing**: Different prices for different quantities
   - **Price**: Enter amount (e.g., $10.00)
   - **Billing period**: 
     - **Recurring**: Monthly, Yearly, Weekly, etc.
     - **One time**: One-time payment
   - **Currency**: USD, EUR, etc.

4. Click **"Save product"**

### **Step 2: Find the Price ID**

After creating a product, you'll automatically get a Price ID:

1. Go to **Products** in Stripe Dashboard
2. Click on your product
3. You'll see the **Price ID** displayed:
   - Format: `price_1ABC123xyz789`
   - Or click on the price to see full details

**Visual Guide:**
```
Product: "Monthly Donation Plan"
├─ Price ID: price_1ABC123xyz789
├─ Amount: $10.00
├─ Currency: USD
└─ Billing: Monthly (recurring)
```

### **Step 3: Copy the Price ID**

1. Click on the product/price in Stripe Dashboard
2. Find the **Price ID** field (starts with `price_`)
3. Click **"Copy"** or manually copy it
4. Use it in your backend/frontend code

---

## 🎯 Multiple Prices for One Product

You can create multiple prices for the same product (e.g., monthly and yearly):

**Product: "Donation Plan"**
- Price 1: `price_ABC123` - $10/month (Monthly)
- Price 2: `price_XYZ789` - $100/year (Yearly)
- Price 3: `price_DEF456` - $5/month (Tier 2)

---

## 💻 How to Use Price ID in Your Backend

### **Option 1: Hardcode in Frontend** (Recommended for simple cases)

```javascript
// Frontend code
const DONATION_PLANS = {
  monthly: {
    name: "Monthly Donation",
    priceId: "price_1ABC123xyz789",  // From Stripe Dashboard
    amount: "$10/month"
  },
  yearly: {
    name: "Yearly Donation",
    priceId: "price_1XYZ789abc123",  // From Stripe Dashboard
    amount: "$100/year"
  }
};

// When user selects a plan:
const selectedPlan = DONATION_PLANS.monthly;

// Call backend API:
const response = await fetch('/api/payments/stripe/create-subscription', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    userId: currentUser.id,
    priceId: selectedPlan.priceId  // Use the Price ID from Stripe
  })
});
```

### **Option 2: Store in Database** (Recommended for dynamic pricing)

1. Create a `SubscriptionPlan` collection in MongoDB
2. Store Price IDs in your database:

```javascript
// MongoDB Document Example
{
  name: "Monthly Donation",
  amount: 10,
  currency: "USD",
  interval: "month",
  stripePriceId: "price_1ABC123xyz789",  // From Stripe Dashboard
  description: "Monthly recurring donation",
  active: true
}
```

3. Fetch plans from your backend API:

```javascript
// GET /api/subscription-plans
const plans = await fetch('/api/subscription-plans');

// Display plans to user
plans.forEach(plan => {
  // Show plan.name, plan.amount, etc.
  // When selected, use plan.stripePriceId
});

// Create subscription with selected Price ID
await fetch('/api/payments/stripe/create-subscription', {
  body: JSON.stringify({
    userId: currentUser.id,
    priceId: selectedPlan.stripePriceId  // From database
  })
});
```

### **Option 3: Fetch from Stripe API** (For dynamic Stripe integration)

```javascript
// Backend: Fetch prices from Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const prices = await stripe.prices.list({
  active: true,
  limit: 10
});

// Returns array of prices with price IDs
prices.data.forEach(price => {
  console.log(price.id);  // price_1ABC123xyz789
  console.log(price.amount);  // 1000 (in cents)
  console.log(price.currency);  // usd
  console.log(price.recurring?.interval);  // month
});
```

---

## 🔍 Finding Price ID via Stripe API

If you want to fetch prices programmatically:

### **Backend Example:**

```javascript
// Get all active prices
const prices = await stripe.prices.list({
  active: true,
  limit: 100
});

// Filter by product or amount
const monthlyPrices = prices.data.filter(
  price => price.recurring?.interval === 'month'
);

// Use price.id as priceId
console.log(monthlyPrices[0].id);  // price_1ABC123xyz789
```

---

## 📋 Complete Example Flow

### **1. Setup in Stripe Dashboard:**
```
Product: "women-help-api Monthly Donation"
  ├─ Price ID: price_1ABC123xyz789
  ├─ Amount: $10.00 USD
  └─ Billing: Monthly (recurring)
```

### **2. Frontend Selection:**
```javascript
// User sees: "Monthly Donation - $10/month"
// User clicks: "Subscribe"

// Frontend sends to backend:
POST /api/payments/stripe/create-subscription
{
  "userId": "507f1f77bcf86cd799439011",
  "priceId": "price_1ABC123xyz789"  // From Stripe Dashboard
}
```

### **3. Backend Processes:**
```javascript
// Backend receives priceId and creates subscription
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],  // Uses the Price ID
  // ...
});
```

### **4. Webhook Updates MongoDB:**
```javascript
// Webhook receives subscription with priceId
// Saves to MongoDB:
{
  userId: "...",
  priceId: "price_1ABC123xyz789",  // Stored for reference
  status: "active",
  // ...
}
```

---

## 🎯 Best Practices

### **1. Store Price IDs in Your Database**
- Easier to manage multiple plans
- Can update prices without code changes
- Track which plans are active/inactive

### **2. Use Environment Variables for Test/Production**
```env
# Test mode
STRIPE_TEST_PRICE_ID_MONTHLY=price_1ABC123xyz789

# Production mode
STRIPE_PROD_PRICE_ID_MONTHLY=price_1XYZ789abc123
```

### **3. Validate Price IDs Exist**
```javascript
// Backend validation
const price = await stripe.prices.retrieve(priceId);
if (!price.active) {
  throw new Error('Price is not active');
}
```

---

## 🔗 Links Between Models

### **Stripe Dashboard:**
```
Product: "Monthly Donation"
  └─> Price: price_1ABC123xyz789 ($10/month)
      └─> Subscription: sub_XYZ789
          └─> Customer: cus_ABC123
```

### **Your MongoDB:**
```
User Document:
  └─> stripeCustomerId: "cus_ABC123"

Subscription Document:
  ├─> userId: ObjectId("...")
  ├─> stripeCustomerId: "cus_ABC123"
  ├─> stripeSubscriptionId: "sub_XYZ789"
  └─> priceId: "price_1ABC123xyz789"  // Links back to Stripe Price
```

---

## 🧪 Testing with Test Mode

1. **Enable Test Mode** in Stripe Dashboard
2. **Create test products/prices** in test mode
3. **Use test Price IDs** in your development environment
4. **Switch to Live Mode** for production and create new products/prices

**Important:** Test and Live mode Price IDs are different!

---

## 📞 Quick Reference

| Item | Format | Example | Where to Find |
|------|--------|---------|---------------|
| **Product ID** | `prod_ABC123` | `prod_1ABC123xyz` | Stripe Dashboard → Products |
| **Price ID** | `price_ABC123` | `price_1ABC123xyz` | Stripe Dashboard → Products → Price section |
| **Customer ID** | `cus_ABC123` | `cus_ABC123xyz` | Created by backend, stored in MongoDB |
| **Subscription ID** | `sub_ABC123` | `sub_ABC123xyz` | Created by backend, stored in MongoDB |

---

## ❓ FAQ

### **Q: Can I change a Price ID after creating it?**
A: No, Price IDs are immutable. If you need to change the price:
1. Create a new Price ID in Stripe
2. Update your code/database with the new Price ID
3. Users with old subscriptions keep the old Price ID

### **Q: Can I have multiple Price IDs for the same amount?**
A: Yes! Each Price ID is unique. You can have:
- `price_ABC123` - $10/month (Plan A)
- `price_XYZ789` - $10/month (Plan B)

### **Q: Do I need to create Products and Prices in Stripe Dashboard?**
A: Yes, for subscriptions. You can create them:
- Manually in Stripe Dashboard (recommended)
- Programmatically via Stripe API (for dynamic creation)

### **Q: What's the difference between Product and Price?**
A: 
- **Product**: The item/service you're selling (e.g., "Monthly Donation Plan")
- **Price**: The pricing details (e.g., "$10/month") - linked to a Product

One Product can have multiple Prices (monthly, yearly, etc.)

---

**Summary:** Price ID is created in Stripe Dashboard when you create a Product with pricing. Copy it from the Stripe Dashboard and use it in your `create-subscription` API call!

