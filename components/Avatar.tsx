import React, { useState } from 'react';
import { View, Image, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { imageService } from '../services/imageService';

interface AvatarProps {
  src?: string | null;
  firstName?: string;
  lastName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  firstName,
  lastName,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const getSizeStyles = () => {
    // If className contains w-full h-full, use flex: 1 to fill container
    if (className.includes('w-full') && className.includes('h-full')) {
      return { flex: 1 };
    }
    
    switch (size) {
      case 'sm':
        return { width: 32, height: 32 };
      case 'md':
        return { width: 48, height: 48 };
      case 'lg':
        return { width: 64, height: 64 };
      case 'xl':
        return { width: 80, height: 80 };
      default:
        return { width: 48, height: 48 };
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 16;
      case 'md':
        return 24;
      case 'lg':
        return 32;
      case 'xl':
        return 40;
      default:
        return 24;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return 12;
      case 'md':
        return 16;
      case 'lg':
        return 20;
      case 'xl':
        return 24;
      default:
        return 16;
    }
  };

  const sizeStyles = getSizeStyles();
  const iconSize = getIconSize();
  const fontSize = getFontSize();
  
  const imageUrl = imageService.getImageUrl(src);
  const initials = imageService.getUserInitials(firstName, lastName);
  const avatarColor = imageService.getAvatarColor(`${firstName} ${lastName}`);

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const handleImageLoadStart = () => {
    setImageLoading(true);
    setImageError(false);
  };

  const handleImageLoadEnd = () => {
    setImageLoading(false);
  };

  return (
    <View 
      className={`rounded-full items-center justify-center overflow-hidden ${className}`}
      style={[
        sizeStyles,
        {
          backgroundColor: imageError || !imageUrl ? avatarColor : 'transparent',
        }
      ]}
    >
      {imageUrl && !imageError ? (
        <>
          <Image
            source={{ uri: imageUrl }}
            style={{
              width: '100%',
              height: '100%',
            }}
            onError={handleImageError}
            onLoadStart={handleImageLoadStart}
            onLoadEnd={handleImageLoadEnd}
            resizeMode="cover"
          />
          {imageLoading && (
            <View 
              style={[
                className.includes('w-full') && className.includes('h-full') 
                  ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }
                  : sizeStyles, 
                { 
                  position: 'absolute',
                  borderRadius: className.includes('w-full') && className.includes('h-full') 
                    ? 1000 // Large value to ensure it's circular
                    : (sizeStyles as any).width ? (sizeStyles as any).width / 2 : 24,
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  justifyContent: 'center',
                  alignItems: 'center'
                }
              ]}
            >
              <ActivityIndicator color="white" size="small" />
            </View>
          )}
        </>
      ) : initials && initials !== '?' ? (
        <Text 
          className="font-semibold text-white"
          style={{ 
            fontSize,
          }}
        >
          {initials}
        </Text>
      ) : (
        <Ionicons 
          name="person-outline" 
          size={iconSize} 
          color="white" 
        />
      )}
    </View>
  );
};

export default Avatar;