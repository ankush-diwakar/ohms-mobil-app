import React from 'react';
import { View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import LottieView from 'lottie-react-native';
import { useFonts, Poppins_400Regular, Poppins_500Medium } from '@expo-google-fonts/poppins';

interface LoadingProps {
  message?: string;
  animationSize?: number;
}

const Loading: React.FC<LoadingProps> = ({ 
  message = 'Loading...', 
  animationSize = 150 
}) => {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
  });

  return (
    <View 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
      }}
    >
      <StatusBar style="dark" backgroundColor="white" />
      <LottieView
        source={require('../animations/eye.json')}
        autoPlay
        loop
        style={{
          width: animationSize,
          height: animationSize,
        }}
      />
      <Text 
        style={{
          marginTop: 16,
          fontSize: 16,
          color: '#6b7280',
          textAlign: 'center',
          fontFamily: fontsLoaded ? 'Poppins_500Medium' : undefined,
        }}
      >
        {message}
      </Text>
    </View>
  );
};

export default Loading;