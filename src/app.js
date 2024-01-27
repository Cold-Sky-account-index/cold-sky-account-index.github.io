// @ts-check

import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
} from "react-router-dom";

import { createTheme, ThemeProvider } from '@mui/material';

import { RootLayout } from './root-layout';
import { Update } from './update/update';

class App extends React.Component {
  render() {
    return <RootLayout />;
  }
}

function bootBrowser() {
  const preloadedTable = document.querySelector('body>table');

  const reactRoot = document.createElement('div');
  reactRoot.id = 'reactRoot';
  document.body.appendChild(reactRoot);

  preloadedTable?.remove();

  const root = createRoot(reactRoot);

  const useHashRouter =
    /file/i.test(location.protocol) || /(github\.dev)|127|localhost/i.test(location.hostname);
  const useRouter =
    useHashRouter ?
      createHashRouter : createBrowserRouter;

  const router = useRouter(
    [
      { path: '/', element: <App /> },
      { path: '/index.html', element: <App /> },
      { path: '/update/*', element: <Update /> }
    ], {
      basename:
        useHashRouter || /file/i.test(location.protocol) ? undefined :
        detectBaseURL(),
  });

  const theme = createTheme({
    components: {
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: 'white',
            color: 'black',
            border: 'solid 1px #e8e8e8',
            boxShadow: '3px 3px 8px rgba(0, 0, 0, 12%)',
            fontSize: '90%',
            // maxWidth: '40em',
            padding: '0.7em',
            paddingRight: '0.2em'
          },
        },
      },
    },
  });

  root.render(
    <ThemeProvider theme={theme}>
      <RouterProvider router={router} />
    </ThemeProvider>
  );

  function detectBaseURL() {
    if (/file/i.test(location.protocol)) return './';

    if (['localhost', '127.0.0.1'].indexOf(location.hostname.toLowerCase()) >= 0 || /github\.dev/i.test(location.hostname)) {
      var staticPos = location.pathname.toLowerCase().indexOf('/static/');
      if (staticPos >= 0) return location.pathname.slice(0, staticPos + '/static'.length);
      var indexHTMLPos = location.pathname.toLowerCase().indexOf('/index.html');
      if (indexHTMLPos >= 0) return location.pathname.slice(0, indexHTMLPos + 1);
      return '/';
    }

    return '/';
  }
}

if (typeof window !== 'undefined' && window)
  bootBrowser();
else if (typeof require === 'function' && typeof process !== 'undefined')
  console.log('REMOVED - nodeRunUpdateDIDs();');
