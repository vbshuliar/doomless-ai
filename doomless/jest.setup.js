import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('@react-native-documents/picker', () => ({
  __esModule: true,
  pick: jest.fn(),
  isErrorWithCode: jest.fn((error) => Boolean(error && typeof error.code === 'string')),
  errorCodes: {
    OPERATION_CANCELED: 'OPERATION_CANCELED',
    IN_PROGRESS: 'ASYNC_OP_IN_PROGRESS',
    UNABLE_TO_OPEN_FILE_TYPE: 'UNABLE_TO_OPEN_FILE_TYPE',
  },
  types: {
    pdf: 'pdf',
    plainText: 'plainText',
    doc: 'doc',
    docx: 'docx',
    allFiles: 'allFiles',
  },
}));
