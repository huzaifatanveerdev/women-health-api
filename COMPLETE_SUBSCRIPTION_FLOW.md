# Complete Subscription Plan Flow - Step by Step Guide

## 📋 **Overview**

This document describes the complete flow from when a user opens the subscription plans page to when they have an active subscription, including all backend APIs and Stripe API calls.

---

## 🎯 **Complete User Journey**

```
1. User opens subscription plans page
   ↓
2. Frontend fetches plans from your database
   ↓
3. User selects a subscription plan
   ↓
4. Frontend creates SetupIntent (for card collection)
   ↓
5. User enters card details (Stripe Elements)
   ↓
6. Frontend confirms SetupIntent (saves card to customer)
   ↓
7. Frontend creates subscription with selected plan
   ↓
8. Frontend confirms payment with PaymentIntent
   ↓
9. Stripe processes payment
   ↓
10. Stripe sends webhook to backend
   ↓
11. Backend updates MongoDB subscription status
   ↓
12. User has active subscription
```

---

## 📱 **Step-by-Step Flow**

### **STEP 1: User Opens Subscription Plans Page**

**What happens:**
- User navigates to subscription plans page in your frontend app
- Frontend needs to fetch available subscription plans

**Frontend Action:**
```javascript
// Fetch subscription plans from your backend
const response = await fetch('{{BaseURL}}/api/subscription-plans', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
    // No authentication required (public endpoint)
  }
});

const result = await response.json();
// result.data contains array of subscription plans
```

**Your Backend API:**
```
GET /api/subscription-plans
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription plans retrieved successfully",
  "data": [
    {
      "_id": "690a659058a2e745deb725d6",
      "name": "Impact",
      "tag": "10%",
      "amount": "39,95",
      "currencySymbol": "€",
      "duration": "year",
      "stripePriceId": "price_1SUsulQZqDs5lj1XgcXQ4WKc",
      "active": true,
      "icon": { ... },
      "description": "...",
      // ... other fields
    },
    {
      "_id": "690a66a458a2e745deb725d8",
      "name": "Plus Impact",
      "tag": "18%",
      "amount": "59,95",
      "stripePriceId": "price_1SUsuDQZqDs5lj1XZm55cEjo",
      // ...
    },
    {
      "_id": "690a670858a2e745deb725da",
      "name": "Max Impact",
      "tag": "MOST IMPACTFUL",
      "amount": "199,95",
      "stripePriceId": "price_1SUstOQZqDs5lj1Xd4LPWXUg",
      // ...
    }
  ]
}
```

**Stripe API Called:** None (data comes from your database)

**Backend Processing:**
1. Queries MongoDB `SubscriptionPlan` collection
2. Filters by `active: true`
3. Returns all active subscription plans with their `stripePriceId`

---

### **STEP 2: User Selects a Subscription Plan**

**What happens:**
- User clicks on a subscription plan (e.g., "Impact - €39,95/year")
- Frontend stores the selected plan information
- Frontend shows payment form/checkout page

**Frontend Action:**
```javascript
// User selects a plan
const selectedPlan = {
  _id: "690a659058a2e745deb725d6",
  name: "Impact",
  amount: "39,95",
  stripePriceId: "price_1SUsulQZqDs5lj1XgcXQ4WKc",  // ← Important!
  currencySymbol: "€",
  duration: "year"
};

// Navigate to checkout/payment page
// Show Stripe Elements payment form
```

**Backend API Called:** None yet

**Stripe API Called:** None yet

---

### **STEP 3: Frontend Initializes Stripe Elements**

**What happens:**
- Frontend loads Stripe.js library
- Frontend initializes Stripe Elements for card collection
- Payment form is displayed to user

**Frontend Code:**
```javascript
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe('pk_test_...'); // Your Stripe Publishable Key

// In your payment component
const stripe = useStripe();
const elements = useElements();

// Card element is rendered in the form
```

**Backend API Called:** None

**Stripe API Called:** None (client-side initialization)

---

### **STEP 4: Frontend Creates SetupIntent (Optional but Recommended)**

**What happens:**
- Frontend requests SetupIntent from your backend
- Backend creates Stripe customer (if doesn't exist)
- Backend creates SetupIntent for card collection
- Frontend receives `clientSecret` for SetupIntent

**Frontend Action:**
```javascript
// Get current user ID (from authentication)
const userId = currentUser.id; // e.g., "507f1f77bcf86cd799439011"

// Request SetupIntent from your backend
const response = await fetch('{{BaseURL}}/api/payments/stripe/create-setup-intent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}` // JWT token
  },
  body: JSON.stringify({
    userId: userId
  })
});

const result = await response.json();
// result.data.clientSecret contains the SetupIntent client secret
const setupIntentClientSecret = result.data.clientSecret;
```

**Your Backend API:**
```
POST /api/payments/stripe/create-setup-intent
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011"
}
```

**Backend Processing:**
1. Validates `userId`
2. Finds user in MongoDB
3. Checks if user has `stripeCustomerId`
   - If yes: Uses existing `stripeCustomerId`
   - If no: Creates new Stripe customer and saves `stripeCustomerId` to user
4. Creates SetupIntent in Stripe
5. Returns `clientSecret`

**Stripe API Called by Backend:**
```javascript
// If customer doesn't exist:
stripe.customers.create({
  email: user.email,
  name: user.name,
  metadata: { userId: userId.toString() }
});

// Always:
stripe.setupIntents.create({
  customer: stripeCustomerId,
  payment_method_types: ['card']
});
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

---

### **STEP 5: User Enters Card Details**

**What happens:**
- User fills in card details in Stripe Elements form
- Stripe Elements securely handles card data (never touches your servers)
- Card data is validated in real-time

**Frontend Action:**
```javascript
// User enters card details in Stripe Elements CardElement
// No backend API calls - all handled by Stripe Elements client-side
```

**Backend API Called:** None

**Stripe API Called:** None (client-side validation only)

---

### **STEP 6: Frontend Confirms SetupIntent (Saves Card)**

**What happens:**
- Frontend confirms SetupIntent with Stripe
- Card is saved to Stripe customer (not charged yet)
- Payment method ID is received

**Frontend Action:**
```javascript
// After user enters card and clicks "Save Card" or "Continue"
const { setupIntent, error } = await stripe.confirmCardSetup(setupIntentClientSecret, {
  payment_method: {
    card: cardElement, // Stripe Elements card element
    billing_details: {
      name: user.name,
      email: user.email
    }
  }
});

if (error) {
  // Handle error
  console.error('Setup failed:', error);
} else {
  // SetupIntent succeeded
  const paymentMethodId = setupIntent.payment_method;
  console.log('Card saved:', paymentMethodId);
  // Proceed to create subscription
}
```

**Backend API Called:** None (direct Stripe API call from frontend)

**Stripe API Called by Frontend:**
```
POST https://api.stripe.com/v1/setup_intents/{setupIntentId}/confirm
```

**Result:**
- Card is saved to Stripe customer
- `payment_method` ID is available (e.g., `pm_ABC123xyz`)
- No charge has been made yet

---

### **STEP 7: Frontend Creates Subscription**

**What happens:**
- Frontend sends request to create subscription
- Backend creates Stripe subscription with selected plan's `stripePriceId`
- Backend returns `subscriptionId` and `clientSecret` for payment

**Frontend Action:**
```javascript
// After card is saved, create subscription
const response = await fetch('{{BaseURL}}/api/payments/stripe/create-subscription', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  },
  body: JSON.stringify({
    userId: userId,
    priceId: selectedPlan.stripePriceId  // e.g., "price_1SUsulQZqDs5lj1XgcXQ4WKc"
  })
});

const result = await response.json();
// result.data contains subscriptionId and clientSecret
const { subscriptionId, clientSecret } = result.data;
```

**Your Backend API:**
```
POST /api/payments/stripe/create-subscription
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439011",
  "priceId": "price_1SUsulQZqDs5lj1XgcXQ4WKc"
}
```

**Backend Processing:**
1. Validates `userId` and `priceId`
2. Finds user in MongoDB
3. Gets user's `stripeCustomerId` (creates if doesn't exist)
4. Creates Stripe subscription with:
   - Customer ID
   - Price ID (from selected plan)
   - Payment behavior: `default_incomplete` (requires payment confirmation)
5. Extracts PaymentIntent `clientSecret` from subscription
6. Returns `subscriptionId` and `clientSecret`

**Stripe API Called by Backend:**
```javascript
stripe.subscriptions.create({
  customer: stripeCustomerId,  // e.g., "cus_ABC123xyz"
  items: [{ price: priceId }], // e.g., "price_1SUsulQZqDs5lj1XgcXQ4WKc"
  payment_behavior: 'default_incomplete',
  expand: ['latest_invoice.payment_intent'],
  metadata: {
    userId: userId.toString()
  }
});
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

**What Happens in Stripe:**
- Subscription is created with status `incomplete`
- Invoice is created
- PaymentIntent is created (not yet paid)
- Subscription waits for payment confirmation

---

### **STEP 8: Frontend Confirms Payment**

**What happens:**
- Frontend confirms payment with PaymentIntent
- Stripe processes the first payment
- Subscription status changes based on payment result

**Frontend Action:**
```javascript
// After receiving subscriptionId and clientSecret, confirm payment
const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement, // Or use saved payment method
    billing_details: {
      name: user.name,
      email: user.email
    }
  }
});

if (error) {
  // Payment failed
  console.error('Payment failed:', error);
  // Show error to user
} else {
  // Payment succeeded
  console.log('Payment successful:', paymentIntent);
  // PaymentIntent status: 'succeeded'
  // Redirect to success page
  // Subscription is now active (or will be activated via webhook)
}
```

**Backend API Called:** None (direct Stripe API call from frontend)

**Stripe API Called by Frontend:**
```
POST https://api.stripe.com/v1/payment_intents/{paymentIntentId}/confirm
```

**Result:**
- If payment succeeds:
  - PaymentIntent status: `succeeded`
  - Invoice status: `paid`
  - Subscription status: `active` (or will be updated via webhook)
- If payment fails:
  - PaymentIntent status: `requires_payment_method` or `payment_failed`
  - Subscription status: `incomplete` or `past_due`

---

### **STEP 9: Stripe Processes Payment**

**What happens:**
- Stripe processes the payment with the card
- PaymentIntent status is updated
- Invoice is marked as paid/unpaid
- Subscription status is updated

**Backend API Called:** None (Stripe internal processing)

**Stripe API:** Internal processing

**Result:**
- Payment processed
- Webhook events are triggered (see Step 10)

---

### **STEP 10: Stripe Sends Webhook Events**

**What happens:**
- Stripe automatically sends webhook events to your backend
- Multiple events are sent for different stages

**Stripe Webhook Events (in order):**

#### **Event 1: `payment_intent.succeeded`**
- Triggered when payment succeeds
- Contains PaymentIntent details

#### **Event 2: `invoice.payment_succeeded`**
- Triggered when invoice is paid
- Contains invoice and subscription details

#### **Event 3: `customer.subscription.created` or `customer.subscription.updated`**
- Triggered when subscription status changes
- Contains full subscription details

**Stripe Webhook Call:**
```
POST https://yourdomain.com/api/payments/stripe/webhook
Headers:
  stripe-signature: t=1234567890,v1=ABC123xyz...
Body: (raw JSON event from Stripe)
```

**Your Backend Webhook Endpoint:**
```
POST /api/payments/stripe/webhook
```

**Backend Processing:**
1. Verifies webhook signature using `STRIPE_WEBHOOK_SECRET`
2. Parses webhook event
3. Routes to appropriate handler based on event type
4. Updates MongoDB Subscription document
5. Returns 200 OK to Stripe

**Backend Webhook Handler:**
```javascript
// Events handled:
- customer.subscription.created → Updates subscription status
- customer.subscription.updated → Updates subscription status
- customer.subscription.deleted → Marks subscription as canceled
- invoice.payment_succeeded → Activates subscription
- invoice.payment_failed → Marks subscription as past_due
- payment_intent.succeeded → Logs payment success
- payment_intent.payment_failed → Logs payment failure
```

**MongoDB Updates:**
```javascript
// Subscription document is created/updated:
{
  userId: ObjectId("507f1f77bcf86cd799439011"),
  stripeCustomerId: "cus_ABC123xyz",
  stripeSubscriptionId: "sub_ABC123xyz",
  priceId: "price_1SUsulQZqDs5lj1XgcXQ4WKc",  // From selected plan
  status: "active",  // Updated from webhook
  currentPeriodStart: Date("2025-11-18"),
  currentPeriodEnd: Date("2026-11-18"),
  createdAt: Date(),
  updatedAt: Date()
}
```

---

### **STEP 11: Backend Updates MongoDB**

**What happens:**
- Webhook handler updates Subscription document in MongoDB
- Subscription status is synchronized with Stripe
- User's subscription data is stored in your database

**Backend Processing:**
1. Finds or creates Subscription document
2. Updates subscription fields:
   - `status`: "active", "canceled", "past_due", etc.
   - `currentPeriodStart`: Start of billing period
   - `currentPeriodEnd`: End of billing period
   - `priceId`: From webhook data
3. Saves to MongoDB

**Database State:**
```javascript
// Subscription collection
{
  _id: ObjectId("..."),
  userId: ObjectId("507f1f77bcf86cd799439011"),
  stripeCustomerId: "cus_ABC123xyz",
  stripeSubscriptionId: "sub_ABC123xyz",
  priceId: "price_1SUsulQZqDs5lj1XgcXQ4WKc",
  status: "active",
  currentPeriodStart: ISODate("2025-11-18T00:00:00Z"),
  currentPeriodEnd: ISODate("2026-11-18T00:00:00Z"),
  createdAt: ISODate("2025-11-18T22:30:00Z"),
  updatedAt: ISODate("2025-11-18T22:30:05Z")
}

// User collection (updated)
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  // ... other fields
  stripeCustomerId: "cus_ABC123xyz",  // Linked to Stripe customer
  // ... other fields
}
```

---

### **STEP 12: User Has Active Subscription**

**What happens:**
- Subscription is now active
- User can access subscription features
- Frontend can check subscription status
- Future payments are automatic (handled by Stripe)

**Frontend Can Check Status:**
```javascript
// Option 1: Check via your backend API (create if needed)
GET /api/subscriptions/user-status
// Returns subscription status from MongoDB

// Option 2: Check via Stripe API (requires backend)
GET /api/payments/stripe/subscription-status
// Returns subscription status from Stripe
```

**Subscription is Active:**
- Status: `active`
- First payment: ✅ Paid
- Next billing date: `currentPeriodEnd` (e.g., 2026-11-18)
- Automatic renewals: Enabled (handled by Stripe)
- Future payments: Stripe automatically charges card

---

## 🔄 **Future Payments (Automatic Renewals)**

**What happens after subscription is active:**

1. **At billing period end** (e.g., after 1 year):
   - Stripe automatically creates a new invoice
   - Stripe attempts to charge the saved card
   - Payment succeeds or fails

2. **If payment succeeds:**
   - Webhook: `invoice.payment_succeeded`
   - Backend updates `currentPeriodStart` and `currentPeriodEnd`
   - Subscription continues as `active`

3. **If payment fails:**
   - Webhook: `invoice.payment_failed`
   - Backend updates subscription status to `past_due`
   - Stripe retries payment (configurable)
   - After max retries, subscription may be canceled

4. **Automatic renewal cycle continues** until:
   - User cancels subscription
   - Payment repeatedly fails
   - Subscription is manually canceled

---

## 📊 **Complete API Summary**

### **Your Backend APIs:**

| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|----------------|
| `/api/subscription-plans` | GET | Get all subscription plans | None (public) |
| `/api/payments/stripe/create-setup-intent` | POST | Create SetupIntent for card | Required |
| `/api/payments/stripe/create-subscription` | POST | Create subscription | Required |
| `/api/payments/stripe/webhook` | POST | Handle Stripe webhooks | Stripe signature |
| `/api/payments/stripe/payment-methods` | GET | Get saved payment methods | Required |

### **Stripe APIs Called:**

| API | Called By | Purpose |
|-----|-----------|---------|
| `stripe.customers.create()` | Backend | Create Stripe customer |
| `stripe.setupIntents.create()` | Backend | Create SetupIntent |
| `stripe.setupIntents.confirm()` | Frontend | Confirm SetupIntent (save card) |
| `stripe.subscriptions.create()` | Backend | Create subscription |
| `stripe.paymentIntents.confirm()` | Frontend | Confirm payment |
| Stripe Webhooks | Stripe → Backend | Update subscription status |

---

## 🎯 **Key Points**

1. **Price IDs are stored in your database** - No need to fetch from Stripe at checkout
2. **SetupIntent is optional** - You can collect card directly during subscription creation
3. **Webhooks are critical** - They keep your database in sync with Stripe
4. **First payment requires confirmation** - Future payments are automatic
5. **Subscription status** - Always check MongoDB (not Stripe) for subscription status in your app

---

## 🧪 **Testing Flow**

1. **Create test subscription plans** in your database with test Price IDs
2. **Use Stripe test mode** - Use test API keys and test cards
3. **Test card:** `4242 4242 4242 4242` (always succeeds)
4. **Test webhooks:** Use Stripe CLI to forward webhooks locally
5. **Verify database** - Check MongoDB Subscription collection after each step

---

**This is the complete flow from viewing plans to active subscription!**

