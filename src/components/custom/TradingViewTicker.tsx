import React, { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

const TradingViewTicker: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) {
      return;
    }

    // Clean up previous widget if it exists
    containerRef.current.innerHTML = '<div class="tradingview-widget-container__widget"></div>';

    const isDark = document.documentElement.classList.contains('dark') || resolvedTheme === 'dark';

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      "symbols": [
        {
          "description": "PGK Vs GBP",
          "proName": "FX_IDC:PGKGBP"
        },
        {
          "description": "PGK Vs USD",
          "proName": "FX_IDC:PGKUSD"
        },
        {
          "description": "PGK Vs HKD",
          "proName": "FX_IDC:PGKHKD"
        }
      ],
      "showSymbolLogo": false,
      "colorTheme": isDark ? 'dark' : 'light',
      "isTransparent": true,
      "displayMode": "adaptive",
      "locale": "en"
    });

    containerRef.current.appendChild(script);

    // Basic fade-in effect
    if (containerRef.current) {
      containerRef.current.style.opacity = '0';
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.transition = 'opacity 0.5s ease-in-out';
          containerRef.current.style.opacity = '1';
        }
      }, 100); // Small delay to ensure styles apply for transition
    }

    // Cleanup function
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [mounted, resolvedTheme]); // Re-run when theme changes or mounted

  return (
    <div
      key={resolvedTheme || 'initial'}
      ref={containerRef}
      className="tradingview-widget-container relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border dark:border-white/10" // Added background and rounded corners to match other cards
      style={{
        opacity: mounted ? 1 : 0, // Control opacity based on mounted state
        transition: 'opacity 0.5s ease-in-out',
        // Fades out on the left (0%-10%), opaque (10%-80%), fades in on the right (80%-100%)
        maskImage: 'linear-gradient(to left, transparent 0%, black 10%, black 80%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to left, transparent 0%, black 10%, black 80%, transparent 100%)', // For Safari/Chrome
        // Consider adding a specific height for better alignment, e.g., height: '40px' or '50px'
        // This can help prevent layout shifts or vertical alignment issues with the title.
        // You'll need to experiment to find the best height that matches your title's line height.
        // height: '40px', 
      }}
    >
      <div className="tradingview-widget-container__widget"></div>
      {/* The copyright is optional and can be removed if desired, per TradingView terms if applicable */}
      {/* <div className="tradingview-widget-copyright">
        <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
          <span className="blue-text">Track all markets on TradingView</span>
        </a>
      </div> */}
    </div>
  );
};

export default TradingViewTicker;