import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Game crash:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-6 gap-4">
          <div className="text-6xl">💥</div>
          <h2 className="text-2xl font-black">Er ging iets mis</h2>
          <p className="text-gray-400 text-center max-w-sm">
            Het spel is gecrasht. Probeer het opnieuw.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-full font-bold transition-all mt-2"
          >
            Terug naar Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
