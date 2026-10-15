# Stripe Payment Flow Guide for Mobile Developers

## 🚨 Current Issue

Subscriptions are being created but staying in **"incomplete"** status. This means the payment is not being confirmed by the mobile app.

---

## 📊 How Stripe Subscriptions Work

```
┌──────────────────────────────────────────────────────────────────┐
│ Step 1: Backend creates subscription                             │
│         → Status: "incomplete"                                   │
│         → Returns clientSecret to frontend                       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Step 2: Frontend uses clientSecret to show Payment Sheet         │
│         → User enters card details                               │
│         → User confirms payment                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ Step 3: Stripe processes payment                                 │
│         → Sends webhook to backend                               │
│         → Status changes to "active"                             │
└──────────────────────────────────────────────────────────────────┘
```

**Important:** The subscription will STAY "incomplete" until Step 2 is completed!

---

## 🔑 Backend API: `payment-sheet-config`

### Request

```
POST /api/payments/stripe/payment-sheet-config
```

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <user_token>",
  "stripe-version": "2023-10-16"
}
```

**Body:**
```json
{
  "userId": "user_mongodb_id",
  "priceId": "price_1SUsulQZqDs5lj1XgcXQ4WKc"
}
```

### Response

```json
{
  "success": true,
  "message": "Payment sheet configuration retrieved successfully",
  "data": {
    "customerId": "cus_XXXXX",
    "ephemeralKeySecret": "ek_test_XXXXX",
    "merchantDisplayName": "women-help-api",
    "returnURL": "women-help-api://stripe-redirect",
    "subscriptionId": "sub_XXXXX",
    "paymentIntentClientSecret": "pi_XXXXX_secret_XXXXX"
  }
}
```

---

## 📱 React Native Implementation

### 1. Install Stripe SDK

```bash
npm install @stripe/stripe-react-native
# or
yarn add @stripe/stripe-react-native
```

### 2. Initialize Stripe Provider

```jsx
// App.js or App.tsx
import { StripeProvider } from '@stripe/stripe-react-native';

function App() {
  return (
    <StripeProvider
      publishableKey="pk_test_YOUR_PUBLISHABLE_KEY"
      urlScheme="women-help-api" // Must match returnURL scheme
    >
      <YourApp />
    </StripeProvider>
  );
}
```

### 3. Complete Payment Flow

```javascript
import { 
  initPaymentSheet, 
  presentPaymentSheet 
} from '@stripe/stripe-react-native';

const subscribeUser = async (userId, priceId) => {
  try {
    // ============================================
    // STEP 1: Get payment sheet config from backend
    // ============================================
    const response = await fetch(
      'https://your-api.com/api/payments/stripe/payment-sheet-config',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + userToken,
          'stripe-version': '2023-10-16'
        },
        body: JSON.stringify({
          userId: userId,
          priceId: priceId
        })
      }
    );
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message);
    }
    
    const { data } = result;
    
    console.log('Got payment config:', data);
    
    // ============================================
    // STEP 2: Initialize Payment Sheet (REQUIRED!)
    // ============================================
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: data.merchantDisplayName,
      customerId: data.customerId,
      customerEphemeralKeySecret: data.ephemeralKeySecret,
      paymentIntentClientSecret: data.paymentIntentClientSecret,
      returnURL: data.returnURL,
      // Optional: pre-fill billing details
      defaultBillingDetails: {
        name: 'User Name',
        email: 'user@email.com'
      },
      // Optional: customize appearance
      appearance: {
        colors: {
          primary: '#FF6B6B',
        },
      },
    });

    if (initError) {
      console.error('Payment sheet init error:', initError);
      Alert.alert('Error', initError.message);
      return { success: false, error: initError };
    }

    console.log('Payment sheet initialized successfully');

    // ============================================
    // STEP 3: Present Payment Sheet (REQUIRED!)
    // This shows the payment UI to the user
    // ============================================
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === 'Canceled') {
        // User dismissed the payment sheet
        console.log('User cancelled payment');
        return { success: false, cancelled: true };
      }
      
      console.error('Payment failed:', presentError);
      Alert.alert('Payment Failed', presentError.message);
      return { success: false, error: presentError };
    }

    // ============================================
    // SUCCESS! Payment was completed
    // ============================================
    console.log('Payment successful!');
    Alert.alert('Success', 'Your subscription is now active!');
    
    // The subscription status will automatically change to "active"
    // via webhook on the backend
    
    return { 
      success: true, 
      subscriptionId: data.subscriptionId 
    };

  } catch (error) {
    console.error('Subscription error:', error);
    Alert.alert('Error', error.message);
    return { success: false, error };
  }
};

// Usage in component
const handleSubscribe = async () => {
  setLoading(true);
  
  const result = await subscribeUser(
    currentUser.id,           // MongoDB user ID
    'price_1SUsulQZqDs5lj1XgcXQ4WKc'  // Stripe price ID
  );
  
  setLoading(false);
  
  if (result.success) {
    // Navigate to success screen or refresh subscription status
    navigation.navigate('SubscriptionSuccess');
  }
};
```

---

## 📱 Flutter Implementation

### 1. Install Stripe SDK

```yaml
# pubspec.yaml
dependencies:
  flutter_stripe: ^10.1.1
```

### 2. Initialize Stripe

```dart
// main.dart
import 'package:flutter_stripe/flutter_stripe.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  Stripe.publishableKey = 'pk_test_YOUR_PUBLISHABLE_KEY';
  Stripe.urlScheme = 'women-help-api'; // Must match returnURL scheme
  
  await Stripe.instance.applySettings();
  
  runApp(MyApp());
}
```

### 3. Complete Payment Flow

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_stripe/flutter_stripe.dart';

class StripeService {
  
  Future<Map<String, dynamic>> subscribeUser(String userId, String priceId) async {
    try {
      // ============================================
      // STEP 1: Get payment sheet config from backend
      // ============================================
      final response = await http.post(
        Uri.parse('https://your-api.com/api/payments/stripe/payment-sheet-config'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $userToken',
          'stripe-version': '2023-10-16',
        },
        body: jsonEncode({
          'userId': userId,
          'priceId': priceId,
        }),
      );

      final result = jsonDecode(response.body);
      
      if (result['success'] != true) {
        throw Exception(result['message']);
      }

      final data = result['data'];
      
      print('Got payment config: $data');

      // ============================================
      // STEP 2: Initialize Payment Sheet (REQUIRED!)
      // ============================================
      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          merchantDisplayName: data['merchantDisplayName'],
          customerId: data['customerId'],
          customerEphemeralKeySecret: data['ephemeralKeySecret'],
          paymentIntentClientSecret: data['paymentIntentClientSecret'],
          returnURL: data['returnURL'],
          // Optional: customize appearance
          appearance: PaymentSheetAppearance(
            colors: PaymentSheetAppearanceColors(
              primary: Color(0xFFFF6B6B),
            ),
          ),
        ),
      );

      print('Payment sheet initialized successfully');

      // ============================================
      // STEP 3: Present Payment Sheet (REQUIRED!)
      // This shows the payment UI to the user
      // ============================================
      await Stripe.instance.presentPaymentSheet();

      // ============================================
      // SUCCESS! Payment was completed
      // ============================================
      print('Payment successful!');
      
      return {
        'success': true,
        'subscriptionId': data['subscriptionId'],
      };

    } on StripeException catch (e) {
      if (e.error.code == FailureCode.Canceled) {
        // User dismissed the payment sheet
        print('User cancelled payment');
        return {'success': false, 'cancelled': true};
      }
      
      print('Payment failed: ${e.error.message}');
      return {'success': false, 'error': e.error.message};
      
    } catch (e) {
      print('Subscription error: $e');
      return {'success': false, 'error': e.toString()};
    }
  }
}

// Usage in widget
class SubscriptionScreen extends StatelessWidget {
  final stripeService = StripeService();
  
  void _handleSubscribe() async {
    setState(() => _loading = true);
    
    final result = await stripeService.subscribeUser(
      currentUser.id,
      'price_1SUsulQZqDs5lj1XgcXQ4WKc',
    );
    
    setState(() => _loading = false);
    
    if (result['success'] == true) {
      // Navigate to success screen
      Navigator.pushNamed(context, '/subscription-success');
    }
  }
}
```

---

## 🧪 Testing with Test Cards

Use these test card numbers in Stripe test mode:

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | ✅ Successful payment |
| `4000 0025 0000 3155` | 🔐 Requires 3D Secure authentication |
| `4000 0000 0000 9995` | ❌ Card declined |
| `4000 0000 0000 0002` | ❌ Card declined (generic) |

**Expiry:** Any future date (e.g., 12/34)
**CVC:** Any 3 digits (e.g., 123)
**ZIP:** Any 5 digits (e.g., 12345)

---

## ❌ Common Issues & Solutions

### Issue 1: Payment sheet not appearing

**Cause:** `initPaymentSheet()` is failing silently

**Solution:**
```javascript
const { error } = await initPaymentSheet({...});
if (error) {
  console.error('INIT ERROR:', error);  // Check this!
}
```

### Issue 2: "No payment method" error

**Cause:** `paymentIntentClientSecret` is null or invalid

**Solution:** Check that the API response contains a valid `paymentIntentClientSecret`

### Issue 3: Return URL not working (iOS)

**Cause:** URL scheme not configured in iOS

**Solution:** Add to `ios/Runner/Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>women-help-api</string>
    </array>
  </dict>
</array>
```

### Issue 4: Subscription stays "incomplete"

**Cause:** `presentPaymentSheet()` is not being called, or user is dismissing it

**Solution:** Ensure the full flow is implemented:
1. ✅ Call `payment-sheet-config` API
2. ✅ Call `initPaymentSheet()`
3. ✅ Call `presentPaymentSheet()` ← **This is often missing!**
4. ✅ User completes payment in the sheet

---

## 📋 Checklist Before Going Live

- [ ] Stripe SDK is initialized with publishable key
- [ ] URL scheme is configured for deep linking
- [ ] `payment-sheet-config` API returns valid data
- [ ] `initPaymentSheet()` is called and checked for errors
- [ ] `presentPaymentSheet()` is called after init
- [ ] Error handling is implemented for all steps
- [ ] Test cards work successfully
- [ ] 3D Secure authentication flow works

---

## 🔗 Useful Links

- [Stripe React Native SDK](https://github.com/stripe/stripe-react-native)
- [Stripe Flutter SDK](https://pub.dev/packages/flutter_stripe)
- [Payment Sheet Integration Guide](https://stripe.com/docs/payments/accept-a-payment?platform=react-native&ui=payment-sheet)
- [Test Card Numbers](https://stripe.com/docs/testing#cards)

---

## 📞 Questions?

If you have any questions about this integration:

1. Check the console logs for errors at each step
2. Verify the API response contains all required fields
3. Ensure `presentPaymentSheet()` is being called
4. Test with the `4242 4242 4242 4242` card first

The backend is working correctly - subscriptions are being created and `clientSecret` is being returned. The mobile app just needs to use this `clientSecret` to show the payment sheet and complete the payment!

