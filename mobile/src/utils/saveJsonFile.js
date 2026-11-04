import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Downloads the file in a browser; on a phone it opens the share sheet so the user chooses where to keep it.
export const saveTextFile = async (fileName, content, mimeType) => {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: `Save ${fileName}` });
};

export const saveJsonFile = (fileName, data) =>
  saveTextFile(fileName, JSON.stringify(data, null, 2), 'application/json');
