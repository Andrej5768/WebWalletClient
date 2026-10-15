import { createBrowserRouter } from 'react-router';
import { StartPage } from '../pages/StartPage';

export const router = createBrowserRouter([{ path: '*', element: <StartPage /> }]);
