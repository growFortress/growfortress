import { useEffect, useState } from "preact/hooks";

const MINIMUM_WIDTH = 1650;

interface MinimumScreenSizeProps {
  children: any;
}

export function MinimumScreenSize({ children }: MinimumScreenSizeProps) {
  const [isScreenTooSmall, setIsScreenTooSmall] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(window.innerWidth);

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setCurrentWidth(width);
      const tooSmall = width < MINIMUM_WIDTH;
      setIsScreenTooSmall(tooSmall);

      // Pause/resume rendering based on screen size
      // This prevents PixiJS rendering issues when screen is too small
      if (tooSmall) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
    };

    // Check initial size
    checkScreenSize();

    // Add resize listener with debounce to reduce Graphics recreation
    let resizeTimeout: NodeJS.Timeout;
    const debouncedCheck = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(checkScreenSize, 100);
    };

    window.addEventListener("resize", debouncedCheck);

    return () => {
      window.removeEventListener("resize", debouncedCheck);
      clearTimeout(resizeTimeout);
    };
  }, []);

  return (
    <>
      {/* Always render children to keep app mounted */}
      <div style={{ visibility: isScreenTooSmall ? "hidden" : "visible" }}>
        {children}
      </div>

      {/* Show overlay when screen is too small */}
      {isScreenTooSmall && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "#161622",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#e0e0e0",
            padding: "clamp(1rem, 4vw, 2rem)",
            textAlign: "center",
            zIndex: 10000,
            boxSizing: "border-box",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div
            style={{
              width: "min(92vw, 520px)",
              padding: "clamp(1.25rem, 4vw, 2rem)",
              backgroundColor: "#1e1e2e",
              borderRadius: "12px",
              border: "2px solid #7c3aed",
              boxShadow: "0 8px 32px rgba(124, 58, 237, 0.2)",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                fontSize: "clamp(2rem, 10vw, 3rem)",
                marginBottom: "1rem",
              }}
            >
              🖥️
            </div>
            <h1
              style={{
                fontSize: "clamp(1.2rem, 5vw, 1.5rem)",
                fontWeight: "bold",
                marginBottom: "1rem",
                color: "#7c3aed",
              }}
            >
              Ekran za mały
            </h1>
            <p
              style={{
                fontSize: "clamp(0.95rem, 3.5vw, 1rem)",
                lineHeight: "1.6",
                marginBottom: "0.5rem",
              }}
            >
              Grow Fortress wymaga minimalnej szerokości ekranu{" "}
              <strong>{MINIMUM_WIDTH}px</strong>.
            </p>
            <p
              style={{
                fontSize: "clamp(0.85rem, 3.2vw, 0.95rem)",
                color: "#999",
              }}
            >
              Obecnie: <strong>{currentWidth}px</strong>
            </p>
            <p
              style={{
                fontSize: "clamp(0.85rem, 3.2vw, 0.95rem)",
                color: "#999",
                marginTop: "1rem",
              }}
            >
              Zwiększ rozmiar okna przeglądarki lub użyj urządzenia z większym
              ekranem.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
