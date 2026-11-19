import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  state = {error:null};
  static getDerivedStateFromError(error) { return {error}; }
  render() { return this.state.error ? <main className="fatal"><h1>Something interrupted the reader.</h1><p>{String(this.state.error.message)}</p><button onClick={()=>location.reload()}>Restart reader</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
