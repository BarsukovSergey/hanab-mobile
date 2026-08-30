import { registerRootComponent } from 'expo';
import { createElement } from 'react';
import { Provider } from 'react-redux';

import App from './App';
import { store } from './src/store/store';

function Root() {
  return createElement(Provider, { store, children: createElement(App) });
}

registerRootComponent(Root);
