# Stripe Subscription API Documentation

## Overview
This document describes the complete Stripe subscription flow for donation subscriptions. The backend handles customer creation, payment method setup, subscription creation, and webhook processing.

---

## 📋 **API Endpoints Flow & Order**

### **Complete User Journey Flow**

```
1. User selects donation plan (Price ID from Stripe)
   ↓
2. Frontend calls: POST /api/payments/stripe/create-customer (OPTIONAL - auto-created if needed)
   ↓
3. Frontend calls: POST /api/payments/stripe/create-setup-intent
   ↓
4. Frontend collects card details using Stripe Elements with clientSecret
   ↓
5. Frontend calls: POST /api/payments/stripe/create-subscription
   ↓
6. Frontend confirms payment using Stripe Elements with clientSecret
   ↓
7. Stripe sends webhook events → POST /api/payments/stripe/webhook (AUTOMATIC)
   ↓
8. Backend updates subscription status in MongoDB
```

---

## 🔗 **API Endpoints Details**

### **1. Create/Retrieve Stripe Customer**

**Endpoint:** `POST /api/payments/stripe/create-customer`

**Who Calls:** Frontend (OPTIONAL - customer is auto-created if missing)

**When:** 
- Before first subscription attempt
- Or skip this - customer is auto-created by other endpoints

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439011"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Stripe customer created/retrieved successfully",
  "data": {
    "stripeCustomerId": "cus_ABC123xyz"
  }
}
```

**Notes:**
- Creates a Stripe customer if one doesn't exist
- If customer already exists, returns existing `stripeCustomerId`
- Saves `stripeCustomerId` to User document in MongoDB
- Links User → Stripe Customer via `userId` in metadata

---

### **2. Create Setup Intent**

**Endpoint:** `POST /api/payments/stripe/create-setup-intent`

**Who Calls:** Frontend

**When:** 
- Before collecting card details
- Used to securely collect payment method without charging

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439011"
}
```

**Response:**
```json
{
  "success": true,
  "message": "SetupIntent created successfully",
  "data": {
    "clientSecret": "seti_ABC123xyz_secret_DEF456"
  }
}
```

**Frontend Implementation:**
```javascript
// After receiving clientSecret, use Stripe Elements:
const stripe = Stripe('pk_test_your_publishable_key');

// Collect card details
const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
  payment_method: {
    card: cardElement, // Stripe Elements card element
    billing_details: {
      name: 'User Name'
    }
  }
});

// Payment method is now saved to customer
// Use the setupIntent.payment_method.id for subscription
```

**Notes:**
- Creates Stripe customer automatically if missing
- Returns `clientSecret` for Stripe Elements integration
- Payment method is saved to customer (not charged yet)
- Payment method can be reused for subscriptions

---

### **3. Create Subscription**

**Endpoint:** `POST /api/payments/stripe/create-subscription`

**Who Calls:** Frontend

**When:** 
- After user selects donation plan (Price ID)
- After payment method is collected (via SetupIntent or directly)

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "priceId": "price_ABC123xyz"  // Stripe Price ID from your Stripe Dashboard
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription created successfully",
  "data": {
    "subscriptionId": "sub_ABC123xyz",
    "clientSecret": "pi_ABC123xyz_secret_DEF456"
  }
}
```

**Frontend Implementation:**
```javascript
// After receiving response, confirm payment:
const stripe = Stripe('pk_test_your_publishable_key');

const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement, // Or use saved payment method
    billing_details: {
      name: 'User Name'
    }
  }
});

if (error) {
  // Handle error
} else {
  // Payment successful, subscription is active
  // Webhook will update subscription status automatically
}
```

**Notes:**
- Creates Stripe customer automatically if missing
- Links Product/Price → Customer via `priceId` parameter
- Subscription status starts as `incomplete` until payment succeeds
- `clientSecret` is for PaymentIntent (first payment)
- After payment succeeds, webhook updates subscription to `active`
- Future payments are automatic (subscription billing)

---

### **4. Get Payment Methods**

**Endpoint:** `GET /api/payments/stripe/payment-methods?userId=507f1f77bcf86cd799439011`

**Who Calls:** Frontend

**When:** 
- To display saved payment methods
- Before creating new subscription (check if payment method exists)
- User profile/settings page

**Query Parameters:**
- `userId` (required): User ID from MongoDB

**Response:**
```json
{
  "success": true,
  "message": "Payment methods retrieved successfully",
  "data": {
    "paymentMethods": [
      {
        "id": "pm_ABC123xyz",
        "type": "card",
        "card": {
          "brand": "visa",
          "last4": "4242",
          "exp_month": 12,
          "exp_year": 2025
        }
      }
    ]
  }
}
```

**Notes:**
- Returns empty array `[]` if no payment methods exist
- Returns empty array if customer doesn't exist
- Only returns card payment methods
- Frontend can display saved cards for user selection

---

### **5. Webhook Endpoint (Backend Only)**

**Endpoint:** `POST /api/payments/stripe/webhook`

**Who Calls:** Stripe (AUTOMATIC)

**When:** 
- Automatically called by Stripe when events occur
- No frontend involvement needed

**Webhook Events Handled:**
1. `customer.subscription.created` - Subscription created
2. `customer.subscription.updated` - Subscription status changed
3. `customer.subscription.deleted` - Subscription canceled
4. `invoice.payment_succeeded` - Payment successful (activates subscription)
5. `invoice.payment_failed` - Payment failed (marks subscription as past_due)
6. `payment_intent.succeeded` - Payment intent succeeded
7. `payment_intent.payment_failed` - Payment intent failed

**Webhook Actions:**
- Updates Subscription document in MongoDB with latest status
- Saves `stripeCustomerId`, `stripeSubscriptionId`, `priceId`, `status`
- Updates `currentPeriodStart` and `currentPeriodEnd`
- Links User → Subscription via `userId` from metadata

**Configuration Required:**
1. Add webhook endpoint in Stripe Dashboard:
   - URL: `https://yourdomain.com/api/payments/stripe/webhook`
   - Events: `customer.subscription.*`, `invoice.payment_*`, `payment_intent.*`
2. Copy webhook signing secret to `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_ABC123xyz
   ```

---

## 🔄 **Complete Flow Diagram**

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │
       │ 1. User selects donation plan
       │    Price ID: "price_ABC123"
       │
       ▼
┌─────────────────────────────────────┐
│ POST /create-setup-intent           │
│ { userId: "user123" }               │
└──────┬──────────────────────────────┘
       │
       │ Returns: clientSecret
       │
       ▼
┌─────────────────────────────────────┐
│ Stripe Elements:                    │
│ - Collect card details              │
│ - confirmCardSetup(clientSecret)    │
└──────┬──────────────────────────────┘
       │
       │ Payment method saved to customer
       │
       ▼
┌─────────────────────────────────────┐
│ POST /create-subscription           │
│ { userId: "user123",                │
│   priceId: "price_ABC123" }         │
└──────┬──────────────────────────────┘
       │
       │ Returns: subscriptionId, clientSecret
       │
       ▼
┌─────────────────────────────────────┐
│ Stripe Elements:                    │
│ - confirmCardPayment(clientSecret)  │
└──────┬──────────────────────────────┘
       │
       │ Payment processing...
       │
       ▼
┌─────────────────────────────────────┐
│ Stripe Webhooks (AUTOMATIC)         │
│ POST /webhook                       │
│ - invoice.payment_succeeded         │
│ - customer.subscription.updated     │
└──────┬──────────────────────────────┘
       │
       │ Updates MongoDB:
       │ - Subscription.status = "active"
       │ - Subscription.currentPeriodStart/End
       │
       ▼
┌─────────────────────────────────────┐
│ Subscription Active                 │
│ Future payments are automatic       │
└─────────────────────────────────────┘
```

---

## 🔗 **How Products/Prices Link to Customers**

### **Connection Chain:**

```
User (MongoDB)
  └─> stripeCustomerId: "cus_ABC123"
        └─> Stripe Customer
              └─> Subscriptions: ["sub_XYZ789"]
                    └─> Subscription Items
                          └─> Price: "price_ABC123"
                                └─> Product: "prod_XYZ789"
```

### **Data Flow:**

1. **User selects Price ID:**
   - Frontend has Price ID from your Stripe Dashboard
   - Price ID format: `price_ABC123xyz`
   - Price ID contains Product information

2. **Subscription Creation:**
   - Backend receives `userId` and `priceId`
   - Finds/creates Stripe Customer linked to User
   - Creates Subscription with `priceId`
   - Stripe automatically links: Customer → Subscription → Price → Product

3. **Webhook Updates:**
   - When subscription is created/updated, webhook receives full subscription object
   - Backend extracts `priceId` from subscription.items[0].price.id
   - Saves to MongoDB Subscription document

4. **MongoDB Storage:**
   ```javascript
   {
     userId: ObjectId("507f1f77bcf86cd799439011"),
     stripeCustomerId: "cus_ABC123",
     stripeSubscriptionId: "sub_XYZ789",
     priceId: "price_ABC123",  // Links to Product
     status: "active",
     currentPeriodStart: Date,
     currentPeriodEnd: Date
   }
   ```

---

## 💳 **Payment Methods Fetching**

### **Status:** ✅ **IMPLEMENTED**

**Endpoint:** `GET /api/payments/stripe/payment-methods?userId=USER_ID`

**Usage:**
```javascript
// Frontend example:
const response = await fetch(
  `/api/payments/stripe/payment-methods?userId=${userId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const { data } = await response.json();
const paymentMethods = data.paymentMethods;

// Display saved cards:
paymentMethods.forEach(pm => {
  console.log(`${pm.card.brand} ending in ${pm.card.last4}`);
});
```

**Returns:**
- List of saved payment methods for the customer
- Empty array if no payment methods exist
- Card details (brand, last4, exp_month, exp_year)

---

## 📝 **Frontend Developer Checklist**

### **Required Stripe Configuration:**
1. ✅ Get Stripe Publishable Key from Stripe Dashboard
2. ✅ Install Stripe.js: `npm install @stripe/stripe-js`
3. ✅ Install Stripe Elements: `npm install @stripe/react-stripe-js` (React) or use Stripe.js directly

### **Environment Variables:**
```env
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
API_BASE_URL=https://your-api-domain.com/api
```

### **API Integration Steps:**

#### **Step 1: Initialize Stripe**
```javascript
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
```

#### **Step 2: Create Setup Intent (Optional - for saving cards)**
```javascript
const response = await fetch('/api/payments/stripe/create-setup-intent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ userId })
});

const { data } = await response.json();
const { clientSecret } = data;

// Use with Stripe Elements to collect card
const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { name }
  }
});
```

#### **Step 3: Create Subscription**
```javascript
const response = await fetch('/api/payments/stripe/create-subscription', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    userId,
    priceId: 'price_ABC123' // From your Stripe Dashboard
  })
});

const { data } = await response.json();
const { subscriptionId, clientSecret } = data;

// Confirm payment
const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement // Or use saved payment method ID
  }
});
```

#### **Step 4: Check Subscription Status**
- Poll your own backend endpoint (create a GET endpoint if needed)
- Or listen to webhook events from your backend
- Subscription status is updated via webhooks automatically

### **Error Handling:**
All endpoints return standard error format:
```json
{
  "success": false,
  "message": "Error message",
  "errors": ["Validation error details"]
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `500` - Server Error

---

## 🔐 **Security Notes**

1. **Never expose Stripe Secret Key** - Keep it server-side only
2. **Always verify webhook signatures** - Already implemented in backend
3. **Use HTTPS** - Required for Stripe webhooks in production
4. **Validate userId** - Ensure user can only access their own data
5. **Authentication required** - All endpoints (except webhook) require JWT token

---

## 📊 **Database Models**

### **User Model** (Updated)
```javascript
{
  _id: ObjectId,
  email: String,
  name: String,
  stripeCustomerId: String,  // NEW: Links to Stripe Customer
  // ... other fields
}
```

### **Subscription Model** (New)
```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // Links to User
  stripeCustomerId: String,   // Links to Stripe Customer
  stripeSubscriptionId: String, // Links to Stripe Subscription
  priceId: String,            // Links to Stripe Price/Product
  status: String,             // active, canceled, past_due, etc.
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🧪 **Testing**

### **Stripe Test Mode:**
1. Use test API keys: `sk_test_...` and `pk_test_...`
2. Use test card: `4242 4242 4242 4242`
3. Use Stripe CLI for local webhook testing:
   ```bash
   stripe listen --forward-to localhost:3000/api/payments/stripe/webhook
   ```

### **Test Flow:**
1. Create test user
2. Call `create-setup-intent` → Get `clientSecret`
3. Use Stripe test card with `clientSecret`
4. Call `create-subscription` → Get `subscriptionId` and `clientSecret`
5. Confirm payment with test card
6. Check webhook events in Stripe Dashboard
7. Verify Subscription document in MongoDB

---

## 📞 **Support**

For Stripe-specific questions, refer to:
- [Stripe Subscriptions Documentation](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Elements Documentation](https://stripe.com/docs/stripe-js)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)

---

**Last Updated:** Generated for Stripe Subscription Backend Implementation

