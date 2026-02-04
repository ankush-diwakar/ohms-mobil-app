const API_IMG_BASE_URL = process.env.EXPO_PUBLIC_API_IMG_URL || process.env.EXPO_PUBLIC_API_BASE_URL || '';

export const imageService = {
  /**
   * Get full image URL from relative path
   * @param profilePhoto - relative path of the profile photo
   * @returns full URL or null if no photo
   */
  getImageUrl: (profilePhoto?: string | null): string | null => {
    if (!profilePhoto) {
      return null;
    }
    
    // If it's already a full URL, return as is
    if (profilePhoto.startsWith('http')) {
      return profilePhoto;
    }
    
    // Construct full URL from base URL and relative path
    const baseUrl = API_IMG_BASE_URL;
    if (!baseUrl) {
      console.warn('API image base URL not configured');
      return null;
    }
    
    // Ensure proper URL concatenation
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanPath = profilePhoto.startsWith('/') ? profilePhoto : `/${profilePhoto}`;
    
    const fullUrl = `${cleanBaseUrl}${cleanPath}`;
    return fullUrl;
  },

  /**
   * Get user initials for fallback avatar
   * @param firstName - user's first name
   * @param lastName - user's last name
   * @returns initials string
   */
  getUserInitials: (firstName?: string, lastName?: string): string => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return `${first}${last}` || '?';
  },

  /**
   * Get random avatar color based on user name
   * @param name - user's full name
   * @returns hex color string
   */
  getAvatarColor: (name?: string): string => {
    if (!name) return '#1DA1F2';
    
    const colors = [
      '#1DA1F2', // Blue
      '#17BF63', // Green
      '#F45D22', // Orange
      '#E60023', // Red
      '#BD081C', // Dark Red
      '#00A693', // Teal
      '#744C9E', // Purple
      '#C92A2A', // Crimson
      '#2F9E44', // Forest Green
      '#1864AB', // Dark Blue
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }
};

export default imageService;