import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

// Configure notification handler for foreground display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

class PushNotificationService {
  private static instance: PushNotificationService;
  private pushToken: string | null = null;
  private notificationListener: Notifications.EventSubscription | null = null;
  private responseListener: Notifications.EventSubscription | null = null;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Initialize push notifications - request permission and get token
   * Returns the Expo push token or null if failed
   */
  async initialize(): Promise<string | null> {
    try {
      // Check if running on a physical device (required for push notifications)
      if (!Device.isDevice) {
        console.log('⚠️ Push notifications require a physical device');
        return null;
      }

      // Check and request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('⚠️ Push notification permission not granted');
        return null;
      }

      // Set up Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('queue-updates', {
          name: 'Queue Updates',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0ea5e9',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      }

      // Get the Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID, // Set in .env
      });
      this.pushToken = tokenData.data;
      console.log('✅ Expo push token:', this.pushToken);

      // Setup notification listeners
      this.setupListeners();

      return this.pushToken;
    } catch (error) {
      console.error('❌ Failed to initialize push notifications:', error);
      return null;
    }
  }

  /**
   * Setup notification event listeners
   */
  private setupListeners(): void {
    // When a notification is received while app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('🔔 Notification received in foreground:', notification.request.content.title);
      }
    );

    // When user taps on a notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('🔔 Notification tapped:', response.notification.request.content.title);
        const data = response.notification.request.content.data;
        if (data) {
          this.handleNotificationTap(data);
        }
      }
    );
  }

  /**
   * Handle notification tap - can be extended for navigation
   */
  private handleNotificationTap(data: Record<string, any>): void {
    console.log('🔔 Handling notification tap with data:', data);
    // Navigation can be handled here based on the data
    // e.g., navigate to specific queue screen
  }

  /**
   * Register push token with the backend for a specific staff member
   */
  async registerWithBackend(staffId: string, staffType: string): Promise<void> {
    if (!this.pushToken) {
      console.log('⚠️ No push token available, skipping backend registration');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/notifications/register-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: this.pushToken,
          platform: Platform.OS,
        }),
      });

      if (response.ok) {
        console.log('✅ Push token registered with backend');
      } else {
        const errText = await response.text();
        console.error('❌ Failed to register push token:', response.status, errText);
      }
    } catch (error) {
      console.error('❌ Failed to register push token with backend:', error);
    }
  }

  /**
   * Unregister push token from backend (on logout)
   */
  async unregisterFromBackend(): Promise<void> {
    if (!this.pushToken) return;

    try {
      await fetch(`${API_BASE_URL}/notifications/unregister-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: this.pushToken,
        }),
      });
      console.log('✅ Push token unregistered from backend');
    } catch (error) {
      console.error('❌ Failed to unregister push token:', error);
    }
  }

  /**
   * Get the current push token
   */
  getToken(): string | null {
    return this.pushToken;
  }

  /**
   * Cleanup listeners
   */
  cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
  }
}

export default PushNotificationService;
