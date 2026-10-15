# Price ID Storage Guide

## ✅ **RECOMMENDED APPROACH: Store Price ID in Your Database**

Since you already have a `SubscriptionPlan` model in MongoDB, you should **store the Stripe Price ID in your database**.

---

## 🔄 **Complete Flow**

### **1. Setup Phase (Admin/One-Time):**

#### **Step 1: Create Product/Price in Stripe Dashboard**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create a Product (e.g., "Monthly Donation Plan")
3. Set pricing (e.g., $10/month)
4. **Copy the Price ID** (e.g., `price_1ABC123xyz789`)

#### **Step 2: Create Subscription Plan in Your Database**
```javascript
// Admin creates subscription plan via API
POST /api/subscription-plans

{
  "name": "Monthly Donation",
  "tag": "monthly",
  "amount": "10",
  "impact": "Supports 10 women per month",
  "description": "Monthly recurring donation",
  "currencyName": "USD",
  "currencySymbol": "$",
  "duration": "monthly",
  "color": "#FF5733",
  "stripePriceId": "price_1ABC123xyz789",  // ← From Stripe Dashboard
  "active": true
}
```

**Result:** Your database now has the plan with the Stripe Price ID stored!

---

### **2. User Flow (When User Wants to Subscribe):**

#### **Step 1: User Browses Plans**
```javascript
// Frontend fetches plans from YOUR database
GET /api/subscription-plans

// Response:
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Monthly Donation",
      "amount": "10",
      "currencySymbol": "$",
      "duration": "monthly",
      "stripePriceId": "price_1ABC123xyz789",  // ← Available here!
      "active": true,
      // ... other fields
    }
  ]
}
```

#### **Step 2: User Selects a Plan**
```javascript
// User clicks "Subscribe" on a plan
const selectedPlan = {
  _id: "507f1f77bcf86cd799439011",
  name: "Monthly Donation",
  stripePriceId: "price_1ABC123xyz789",  // ← Use this!
  amount: "10"
};

// Frontend sends Stripe Price ID to create subscription
POST /api/payments/stripe/create-subscription
{
  "userId": "user123",
  "priceId": selectedPlan.stripePriceId  // ← From your database!
}
```

#### **Step 3: Backend Creates Subscription**
- Backend receives `priceId` from your database
- Backend calls Stripe API with `priceId`
- Stripe creates subscription
- Webhook updates MongoDB Subscription document

---

## 📊 **Database Structure**

### **SubscriptionPlan Model (Updated)**

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  name: "Monthly Donation",
  tag: "monthly",
  amount: "10",
  currencySymbol: "$",
  duration: "monthly",
  stripePriceId: "price_1ABC123xyz789",  // ← NEW: Stores Stripe Price ID
  active: true,                          // ← NEW: Enable/disable plans
  // ... other fields
}
```

### **Subscription Model (Stripe Subscriptions)**

```javascript
{
  userId: ObjectId("..."),
  stripeCustomerId: "cus_ABC123",
  stripeSubscriptionId: "sub_XYZ789",
  priceId: "price_1ABC123xyz789",  // ← Links back to Stripe Price
  status: "active",
  // ... other fields
}
```

---

## 🎯 **Why Store Price ID in Database?**

### ✅ **Advantages:**

1. **Control which plans are displayed**
   - Set `active: false` to hide plans
   - No need to modify code

2. **All plan metadata in one place**
   - Name, amount, description, Price ID together
   - Easier to manage

3. **No Stripe API calls needed**
   - Fetch plans from your database
   - Faster response times

4. **Easier testing**
   - Use test Price IDs in development
   - Switch to production Price IDs easily

5. **Better for multi-currency/regions**
   - Store different Price IDs for different regions
   - Same plan, different Stripe Prices

---

## 📝 **Implementation Steps**

### **1. Update SubscriptionPlan Model** ✅ **DONE**

I've already updated your `SubscriptionPlan` model to include:
- `stripePriceId`: Stores Stripe Price ID
- `active`: Enable/disable plans (defaults to `true`)

### **2. Update SubscriptionPlan Service** ✅ **DONE**

Updated `createSubscriptionPlan` to accept:
- `stripePriceId` (optional)
- `active` (optional, defaults to `true`)

Updated `getAllSubscriptionPlans` to only return active plans.

### **3. When Creating a Plan (Admin):**

```javascript
// When creating via POST /api/subscription-plans
{
  // ... existing fields
  "stripePriceId": "price_1ABC123xyz789",  // ← Add this field
  "active": true  // ← Optional, defaults to true
}
```

### **4. Frontend Integration:**

```javascript
// Fetch plans from your database
const response = await fetch('/api/subscription-plans');
const { data } = await response.json();
const plans = data;

// Display plans to user
plans.forEach(plan => {
  console.log(`${plan.name}: ${plan.currencySymbol}${plan.amount}/${plan.duration}`);
  console.log(`Stripe Price ID: ${plan.stripePriceId}`);
});

// When user selects a plan:
const selectedPlan = plans[0];  // User's selection

// Create subscription with Price ID from database
const subscriptionResponse = await fetch('/api/payments/stripe/create-subscription', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    userId: currentUser.id,
    priceId: selectedPlan.stripePriceId  // ← From your database!
  })
});
```

---

## 🔄 **Alternative Approach (Not Recommended)**

### **Fetch Price IDs from Stripe API Dynamically**

You *could* fetch Price IDs from Stripe API when needed, but this is **NOT recommended** because:

❌ Requires Stripe API calls every time
❌ Slower response times
❌ Less control over which plans to show
❌ Harder to manage plan metadata
❌ More complex code

**If you still want this approach:**

```javascript
// Backend endpoint to fetch prices from Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const prices = await stripe.prices.list({
  active: true,
  limit: 100
});

// Return prices to frontend
// Frontend maps Stripe prices to your plans
```

**But this is more complex and not recommended!**

---

## ✅ **Summary**

### **Your Flow (Recommended):**

1. **Admin Setup:**
   - Create Product/Price in Stripe Dashboard
   - Copy Price ID (`price_1ABC123xyz789`)
   - Create SubscriptionPlan in your database with `stripePriceId`

2. **User Flow:**
   - Frontend fetches plans from YOUR database (`GET /api/subscription-plans`)
   - Plans include `stripePriceId` from your database
   - User selects plan
   - Frontend sends `stripePriceId` to `POST /api/payments/stripe/create-subscription`

3. **Backend:**
   - Receives `priceId` from frontend
   - Calls Stripe API with `priceId`
   - Stripe creates subscription
   - Webhook updates MongoDB

---

## 🎯 **Answer to Your Question**

> **"So you mean that the priceId will be fetched from the Stripe when user tries to buy a subscription plan? or i will need to copy and save it in my database first?"**

**Answer:** 

✅ **Store it in your database first!**

1. **Copy Price ID from Stripe Dashboard** (one-time setup)
2. **Save it in your SubscriptionPlan model** when creating a plan
3. **Frontend fetches plans from your database** (includes Price IDs)
4. **When user subscribes, use Price ID from your database**

**You don't fetch Price IDs from Stripe when user tries to buy** - they're already in your database!

---

**Updated Files:**
- ✅ `models/SubscriptionPlan.js` - Added `stripePriceId` and `active` fields
- ✅ `services/subscriptionPlanService.js` - Updated to handle `stripePriceId` and `active`

**Next Steps:**
1. When creating a SubscriptionPlan, add `stripePriceId` field
2. Frontend can now use `stripePriceId` from database when creating subscriptions

