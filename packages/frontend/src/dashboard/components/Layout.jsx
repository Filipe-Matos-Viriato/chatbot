// packages/frontend/src/dashboard/components/Layout.jsx
// This component provides a consistent layout wrapper for dashboard pages.
// It enforces a maximum width and provides optional padding.
// relevant files: Dashboard.jsx, tailwind.config.js

import React from 'react';
import PropTypes from 'prop-types';

const Layout = ({ children, padded = true }) => {
  const layoutClasses = `w-full max-w-dashboard mx-auto ${padded ? 'p-container-padding' : ''}`;

  return (
    <div className={layoutClasses}>
      {children}
    </div>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  padded: PropTypes.bool,
};

export default Layout;