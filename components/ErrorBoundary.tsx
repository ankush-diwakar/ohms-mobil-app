import React from 'react';
import { View, Text } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 justify-center items-center bg-white p-6">
          <Text className="text-xl font-bold text-red-600 mb-4">Something went wrong!</Text>
          <Text className="text-gray-600 text-center mb-4">
            The app encountered an error and couldn't recover.
          </Text>
          <Text className="text-sm text-gray-500 text-center">
            Error: {this.state.error?.message}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}