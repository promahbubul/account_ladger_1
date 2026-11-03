import { Alert, Platform } from 'react-native';

// Alert.alert does nothing on react-native-web, so the browser's dialog is used there.
export const showMessage = (title, message, onClose) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    if (onClose) onClose();
    return;
  }
  Alert.alert(title, message, [{ text: 'OK', onPress: onClose }]);
};
