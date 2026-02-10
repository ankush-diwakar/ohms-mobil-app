# Hospital Management App - Implementation Plan

## Task 1: Fix "Remember Me" Authentication Persistence

### Problem
The "Remember Me" functionality in the login screen doesn't persist user sessions properly:
- App logs users out unexpectedly even when "Remember Me" is checked
- Token expiry is set to only 24 hours instead of 1 week
- Logic flaw causes immediate logout if remember me flag isn't found
- No session extension for active users

### Solution Overview
Implement proper session persistence that works for both mobile app and web without breaking existing API flow.

### Implementation Steps

#### 1. Update Token Expiry Logic
**File:** `contexts/AuthContext.tsx` (around line 270)

**Current Issue:**
```typescript
expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(), // 24 hours
```

**Fix:**
```typescript
// Calculate expiry based on remember me preference
const expiryDuration = rememberMe 
  ? (7 * 24 * 60 * 60 * 1000) // 7 days for remember me
  : (8 * 60 * 60 * 1000);      // 8 hours for regular session

const tokens: AuthTokens = {
  accessToken: token || `session_${Date.now()}`,
  refreshToken: token || `session_${Date.now()}`,
  expiresAt: new Date(Date.now() + expiryDuration).toISOString(),
};
```

#### 2. Fix Remember Me Logic in checkAuthStatus
**File:** `contexts/AuthContext.tsx` (around line 200)

**Current Issue:**
- Immediately logs out if `rememberMe !== 'true'` without checking for valid sessions

**Fix:**
```typescript
const rememberMe = await AsyncStorage.getItem(REMEMBER_ME_KEY);
const tokens = await getStoredTokens();

// If no remember me AND no valid session, logout
if (rememberMe !== 'true' && !tokens) {
  console.log('📱 No remember me and no valid tokens, showing login');
  setUser(null);
  return;
}

// If no remember me but has valid short-term session, check if expired
if (rememberMe !== 'true' && tokens) {
  const now = new Date().getTime();
  const expiresAt = new Date(tokens.expiresAt).getTime();
  
  if (now >= expiresAt) {
    console.log('📱 Short-term session expired, showing login');
    await clearStoredAuth();
    setUser(null);
    return;
  }
}

// Continue with normal token validation...
```

#### 3. Add Session Extension for Active Users
**File:** `contexts/AuthContext.tsx`

**Add new function:**
```typescript
// Extend session when user is active (if remember me is enabled)
const extendSessionIfNeeded = async (): Promise<void> => {
  try {
    const rememberMe = await AsyncStorage.getItem(REMEMBER_ME_KEY);
    const tokens = await getStoredTokens();
    
    if (rememberMe === 'true' && tokens) {
      const now = new Date().getTime();
      const expiresAt = new Date(tokens.expiresAt).getTime();
      const timeUntilExpiry = expiresAt - now;
      
      // If less than 24 hours remaining, extend for another 7 days
      if (timeUntilExpiry < (24 * 60 * 60 * 1000)) {
        const extendedTokens: AuthTokens = {
          ...tokens,
          expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString(),
        };
        
        await storeTokens(extendedTokens, true);
        console.log('🔄 Session extended for active user');
      }
    }
  } catch (error) {
    console.error('❌ Error extending session:', error);
  }
};
```

#### 4. Update AuthContext Interface
**File:** `contexts/AuthContext.tsx`

**Add to AuthContextType interface:**
```typescript
interface AuthContextType {
  // ... existing properties
  extendSessionIfNeeded: () => Promise<void>; // Add this
}

// Add to value object:
const value: AuthContextType = {
  // ... existing values
  extendSessionIfNeeded, // Add this
};
```

#### 5. Implement App State Monitoring
**File:** `App.tsx`

**Add session extension on app activity:**
```typescript
import { AppState } from 'react-native';
import { useAuth } from './contexts/AuthContext';

// Inside App component:
const { extendSessionIfNeeded } = useAuth();

useEffect(() => {
  const handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === 'active') {
      // User became active, extend session if needed
      extendSessionIfNeeded();
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription?.remove();
}, []);
```

### Web Compatibility
- **No backend changes required** - Same API endpoints
- **Cookie fallback maintained** - Web continues using `credentials: 'include'`
- **Graceful degradation** - Tokens fail → cookies still work for web
- **Optional enhancement** - Backend can accept `rememberMe` flag for different cookie expiry

### Testing Checklist
- [ ] Login with "Remember Me" checked → Should stay logged in for 7 days
- [ ] Login without "Remember Me" → Should logout after 8 hours
- [ ] Close/reopen app → Should maintain auth state
- [ ] Manual logout → Should immediately clear all sessions  
- [ ] Web application → Should work unchanged
- [ ] Active user session extension → Should extend before expiry

### Expected Outcomes
- ✅ Users stay logged in for 1 week when "Remember Me" is enabled
- ✅ Automatic session extension for active users
- ✅ Proper session management without breaking web flow
- ✅ Secure token handling with appropriate expiry times
- ✅ Improved user experience with persistent authentication

---

## Task 2: Replace Local Notifications with Push Notifications (OneSignal Integration)

### Problem
Current notification system uses local notifications that only work when app is running:
- Notifications triggered by WebSocket events in `socketService.ts`
- Uses `Notifications.scheduleNotificationAsync()` for local notifications
- **Doesn't work when app is closed/killed**
- Hospital staff miss critical queue updates when app is not active

### Solution Overview
Replace local notification system with OneSignal push notifications that work even when app is completely closed, without changing existing authentication flow.

### Implementation Strategy
- **No Auth Changes**: Keep existing authentication system unchanged
- **Dual Approach**: WebSocket for real-time UI updates + Push notifications for background alerts
- **OneSignal Integration**: Free tier supports up to 10,000 users (perfect for hospital staff)
- **Web Compatibility**: Web continues using existing WebSocket notifications

### Implementation Steps

#### Phase 1: Mobile App Setup

##### 1. Install OneSignal for Expo
```bash
npx expo install react-native-onesignal
```

##### 2. Update app.json Configuration
**File:** `app.json`

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-onesignal", 
        {
          "mode": "production",
          "devMode": false
        }
      ]
    ],
    "android": {
      "permissions": [
        "POST_NOTIFICATIONS",
        "RECEIVE_BOOT_COMPLETED",
        "WAKE_LOCK", 
        "VIBRATE"
      ]
    },
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    }
  }
}
```

##### 3. Create Push Notification Service
**File:** `services/pushNotificationService.ts`

```typescript
import { OneSignal } from 'react-native-onesignal';

export class PushNotificationService {
  private static instance: PushNotificationService;
  private isInitialized = false;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async initialize(appId: string): Promise<void> {
    if (this.isInitialized) return;

    OneSignal.initialize(appId);
    OneSignal.Notifications.requestPermission(true);
    
    this.setupEventListeners();
    this.isInitialized = true;
  }

  async getUserId(): Promise<string | null> {
    return OneSignal.User.pushSubscription.id;
  }

  private setupEventListeners(): void {
    OneSignal.Notifications.addEventListener('click', (event) => {
      console.log('🔔 Push notification clicked:', event);
      // Handle notification tap - navigate to relevant section
    });

    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
      console.log('🔔 Push notification received in foreground:', event);
      // Customize notification display
    });
  }

  async setUserTags(tags: Record<string, string>): Promise<void> {
    OneSignal.User.addTags(tags);
  }
}
```

##### 4. Initialize in App.tsx
**File:** `App.tsx`

```typescript
import { PushNotificationService } from './services/pushNotificationService';

// Inside App component useEffect:
useEffect(() => {
  const initializePushNotifications = async () => {
    try {
      const pushService = PushNotificationService.getInstance();
      await pushService.initialize('YOUR_ONESIGNAL_APP_ID');
      
      // Set user tags for targeting
      if (user) {
        await pushService.setUserTags({
          staffType: user.staffType || 'unknown',
          employeeId: user.employeeId || '',
          department: user.department || ''
        });
      }
    } catch (error) {
      console.error('❌ Failed to initialize push notifications:', error);
    }
  };

  if (user && !isLoading) {
    initializePushNotifications();
  }
}, [user, isLoading]);
```

##### 5. Update Socket Service for Dual Notifications
**File:** `services/socketService.ts`

```typescript
import { PushNotificationService } from './pushNotificationService';

// Replace sendPatientNotification function:
const sendNotificationTrigger = async (patientData: any, action: string) => {
  try {
    // Keep local notification for immediate feedback when app is open
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: getNotificationTitle(action),
          body: getNotificationBody(patientData, action),
        },
        trigger: null, // Immediate
      });
    }

    // Trigger backend push notification for all devices
    const pushService = PushNotificationService.getInstance();
    const userId = await pushService.getUserId();
    
    if (userId) {
      // Send to backend to trigger push notification
      await sendPushNotificationRequest({
        userId,
        title: getNotificationTitle(action),
        message: getNotificationBody(patientData, action),
        data: {
          queueEntryId: patientData.queueEntryId,
          action,
          patientName: getPatientName(patientData)
        }
      });
    }
  } catch (error) {
    console.error('❌ Failed to send notification:', error);
  }
};

const sendPushNotificationRequest = async (notificationData: any) => {
  // Call your backend API to send push notification
  const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
  
  await fetch(`${API_BASE_URL}/notifications/send-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(notificationData)
  });
};
```

#### Phase 2: Backend Setup

##### 1. Install OneSignal Node.js SDK
**In backend directory:**
```bash
npm install onesignal-node
```

##### 2. Create Push Notification Service
**File:** `backend/src/services/pushNotificationService.js`

```javascript
const OneSignal = require('onesignal-node');

class PushNotificationService {
  constructor() {
    this.client = new OneSignal.Client(
      process.env.ONESIGNAL_APP_ID,
      process.env.ONESIGNAL_REST_API_KEY
    );
  }

  async sendToUsers(userIds, title, message, data = {}) {
    try {
      const notification = {
        contents: { en: message },
        headings: { en: title },
        include_player_ids: Array.isArray(userIds) ? userIds : [userIds],
        data: data,
        android_channel_id: "default"
      };

      const response = await this.client.createNotification(notification);
      console.log('✅ Push notification sent:', response.body);
      return response.body;
    } catch (error) {
      console.error('❌ Failed to send push notification:', error);
      throw error;
    }
  }

  async sendToTags(tags, title, message, data = {}) {
    try {
      const notification = {
        contents: { en: message },
        headings: { en: title },
        filters: this.buildTagFilters(tags),
        data: data
      };

      const response = await this.client.createNotification(notification);
      console.log('✅ Push notification sent to tags:', response.body);
      return response.body;
    } catch (error) {
      console.error('❌ Failed to send push notification:', error);
      throw error;
    }
  }

  buildTagFilters(tags) {
    // Build OneSignal tag filters
    return Object.entries(tags).map(([key, value], index) => 
      index === 0 
        ? { field: "tag", key, relation: "=", value }
        : { operator: "AND", field: "tag", key, relation: "=", value }
    );
  }
}

module.exports = new PushNotificationService();
```

##### 3. Create Notification API Endpoint
**File:** `backend/src/routes/notifications.js`

```javascript
const express = require('express');
const pushNotificationService = require('../services/pushNotificationService');
const { authenticateToken } = require('../middleware/auth'); // Use existing auth middleware

const router = express.Router();

// Send push notification (mobile app triggered)
router.post('/send-push', authenticateToken, async (req, res) => {
  try {
    const { userId, title, message, data } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pushNotificationService.sendToUsers(
      userId, 
      title, 
      message, 
      data
    );

    res.json({ 
      success: true, 
      notificationId: result.id,
      message: 'Push notification sent successfully' 
    });
  } catch (error) {
    console.error('Notification API error:', error);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
});

// Send notification to staff type (for queue updates)
router.post('/send-to-staff', authenticateToken, async (req, res) => {
  try {
    const { staffType, title, message, data } = req.body;

    const result = await pushNotificationService.sendToTags(
      { staffType }, 
      title, 
      message, 
      data
    );

    res.json({ 
      success: true, 
      notificationId: result.id,
      message: 'Push notification sent to staff' 
    });
  } catch (error) {
    console.error('Staff notification API error:', error);
    res.status(500).json({ error: 'Failed to send staff notification' });
  }
});

module.exports = router;
```

##### 4. Integrate with Existing Queue Events
**File:** `backend/src/services/queueService.js` (or wherever queue events are emitted)

```javascript
const pushNotificationService = require('./pushNotificationService');

// Add to existing queue update functions:
const sendQueueNotification = async (queueEvent, patientData) => {
  try {
    const notificationConfig = {
      'patient_added': {
        title: '👁️ New Patient in Queue',
        message: `${patientData.patientName} needs: ${patientData.reasons || 'Eye examination'}`,
        staffTypes: ['receptionist2', 'doctor', 'optometrist']
      },
      'patient_ready': {
        title: '✅ Patient Ready for Examination', 
        message: `${patientData.patientName} is ready to resume examination`,
        staffTypes: ['doctor', 'optometrist']
      },
      'patient_resumed': {
        title: '🔄 Patient Resumed',
        message: `${patientData.patientName} has been resumed from observation`,
        staffTypes: ['receptionist2', 'doctor']
      }
    };

    const config = notificationConfig[queueEvent];
    if (config) {
      // Send to each relevant staff type
      for (const staffType of config.staffTypes) {
        await pushNotificationService.sendToTags(
          { staffType },
          config.title,
          config.message,
          {
            queueEvent,
            queueEntryId: patientData.queueEntryId,
            patientId: patientData.patientId
          }
        );
      }
    }
  } catch (error) {
    console.error('❌ Failed to send queue notification:', error);
  }
};

// Call this function whenever queue events occur
// Example: addPatientToQueue, markPatientReady, etc.
```

##### 5. Environment Variables
**File:** `backend/.env`

```env
# OneSignal Configuration
ONESIGNAL_APP_ID=your_onesignal_app_id
ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key
```

### Migration Strategy

#### Phase 1: Setup (Week 1)
- [ ] Create OneSignal account and get App ID/API Key
- [ ] Install OneSignal in mobile app
- [ ] Setup basic push notification infrastructure in backend
- [ ] Test push notifications with app closed

#### Phase 2: Integration (Week 2)  
- [ ] Replace local notifications with push notification triggers
- [ ] Integrate queue events with push notifications in backend
- [ ] Add user targeting based on staff type
- [ ] Test end-to-end notification flow

#### Phase 3: Optimization (Week 3)
- [ ] Fine-tune notification content and timing
- [ ] Add notification analytics tracking
- [ ] Implement notification preferences
- [ ] Production testing and deployment

### Web Compatibility
- **No Impact on Web**: Web continues using existing WebSocket notifications
- **Same Backend Events**: Push notifications triggered by same queue events as WebSocket
- **Authentication Unchanged**: Uses existing auth middleware and session handling
- **Gradual Migration**: Can run both systems in parallel during transition

### Testing Checklist
- [ ] Push notifications work when app is completely closed
- [ ] Notifications appear for relevant staff types only
- [ ] Queue updates trigger both WebSocket (for UI) and push notifications
- [ ] Web application notifications continue working unchanged
- [ ] No authentication changes affect existing web/API flows
- [ ] Notification targeting works correctly (receptionist2, doctors, etc.)

### Expected Outcomes
- ✅ Staff receive critical queue updates even when app is closed
- ✅ Hospital workflow efficiency improved with reliable notifications  
- ✅ No disruption to existing web application functionality
- ✅ Scalable notification system supporting up to 10,000 staff members (OneSignal free tier)
- ✅ Actionable notifications with deep linking to relevant app sections
- ✅ Maintained authentication and security without backend changes

### Cost Analysis
- **OneSignal Free Tier**: Up to 10,000 subscribers (perfect for hospital staff)
- **No Additional Infrastructure**: Leverages existing queue event system
- **Zero Authentication Changes**: Uses current auth system without modification

---