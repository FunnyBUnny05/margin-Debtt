import React from 'react';

const SkeletonBox = ({ width = '100%', height = '20px', style = {} }) => (
  <div
    className="skeleton"
    style={{
      width,
      height,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-loading 1.5s ease-in-out infinite',
      borderRadius: '4px',
      ...style
    }}
  />
);

export const StatCardSkeleton = ({ isMobile }) => (
  <div className="stat-card" style={{ minHeight: isMobile ? '100px' : '120px' }}>
    <SkeletonBox width="60%" height="14px" style={{ marginBottom: '12px' }} />
    <SkeletonBox width="80%" height="32px" style={{ marginBottom: '8px' }} />
    <SkeletonBox width="50%" height="14px" />
  </div>
);

export const ChartSkeleton = ({ height = '350px' }) => (
  <div className="glass-card" style={{ padding: '32px', marginBottom: '24px' }}>
    <SkeletonBox width="200px" height="20px" style={{ marginBottom: '24px' }} />
    <SkeletonBox width="100%" height={height} />
  </div>
);

export const MarginDataSkeleton = ({ isMobile }) => (
  <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
    {/* Header Skeleton */}
    <div className="glass-card animate-in" style={{ padding: isMobile ? '24px 20px' : '32px 40px', marginBottom: '24px' }}>
      <SkeletonBox width="300px" height="36px" style={{ marginBottom: '8px' }} />
      <SkeletonBox width="500px" height="15px" />
    </div>

    {/* Time Range Buttons Skeleton */}
    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
      {[1, 2, 3, 4].map(i => (
        <SkeletonBox key={i} width="60px" height="36px" />
      ))}
    </div>

    {/* Key Metrics Skeleton */}
    <div className="responsive-grid" style={{ marginBottom: '24px' }}>
      {[1, 2, 3, 4].map(i => (
        <StatCardSkeleton key={i} isMobile={isMobile} />
      ))}
    </div>

    {/* Charts Skeleton */}
    <ChartSkeleton height="350px" />
    <ChartSkeleton height="280px" />
  </div>
);

export const LoadingState = ({ type = 'margin', isMobile }) => {
  if (type === 'margin') {
    return (
      <div className="app-background" style={{ padding: isMobile ? '16px' : '24px 32px', minHeight: '100vh' }}>
        <MarginDataSkeleton isMobile={isMobile} />
      </div>
    );
  }

  // Generic loading state for other views
  return (
    <div className="app-background" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass-card" style={{ textAlign: 'center', padding: '48px', maxWidth: '500px' }}>
        <div style={{ fontSize: '48px', marginBottom: '24px' }} className="pulse-animation">📊</div>
        <SkeletonBox width="250px" height="24px" style={{ margin: '0 auto 12px' }} />
        <SkeletonBox width="200px" height="15px" style={{ margin: '0 auto' }} />
        <div style={{ height: '4px', borderRadius: '999px', marginTop: '24px', overflow: 'hidden', background: 'var(--glass-bg)' }}>
          <div className="shimmer" style={{ height: '100%', width: '100%' }} />
        </div>
      </div>
    </div>
  );
};

export default LoadingState;
