# Product Requirements Document: Embeddable Chatbot Widget

## 📋 Overview

This PRD outlines the development of an embeddable chatbot widget that can be integrated into third-party websites. The widget will be built using Webpack and Preact for optimal performance, with unique API access per client.

## 🎯 Objectives

- Create a lightweight, embeddable chatbot widget (<20KB)
- Enable third-party website integration with simple script tag
- Provide unique API access per client with customizable branding
- Maintain cross-domain compatibility and security
- Ensure optimal performance and user experience

## 🔧 Technical Requirements

### Technology Stack
- **Framework**: Preact (for minimal bundle size)
- **Build Tool**: Webpack 5
- **Transpilation**: Babel
- **Styling**: Inline CSS (no external dependencies)
- **Distribution**: UMD module format

### Performance Requirements
- Bundle size < 20KB (gzipped)
- Initial load time < 500ms
- Cross-browser compatibility (IE11+, modern browsers)
- Mobile responsive design

## 🏗️ Implementation Tasks

### Phase 1: Project Setup & Infrastructure

#### Task 1.1: Create Widget Package Structure
**Subtasks:**
- [ ] Create `packages/widget/` directory in existing monorepo
- [ ] Initialize package.json with dependencies:
  - `preact@^10.19.3`
  - `@babel/core@^7.23.6`
  - `@babel/preset-env@^7.23.6`
  - `@babel/preset-react@^7.23.3`
  - `babel-loader@^9.1.3`
  - `css-loader@^6.8.1`
  - `style-loader@^3.3.3`
  - `webpack@^5.89.0`
  - `webpack-cli@^5.1.4`
- [ ] Set up scripts for build and development
- [ ] Create basic directory structure

#### Task 1.2: Configure Webpack Build System
**Subtasks:**
- [ ] Create `webpack.config.js` with UMD output configuration
- [ ] Configure Babel presets for Preact compatibility
- [ ] Set up CSS processing with style-loader and css-loader
- [ ] Configure environment variable injection
- [ ] Set up production optimization (minification, tree-shaking)
- [ ] Configure source map generation for development

#### Task 1.3: Set Up Development Environment
**Subtasks:**
- [ ] Create development watch script
- [ ] Set up hot reload for development
- [ ] Create example HTML file for testing
- [ ] Configure environment variables for API URLs

### Phase 2: Core Widget Development

#### Task 2.1: Create Widget Entry Point
**Subtasks:**
- [ ] Create `src/index.js` with global initialization function
- [ ] Implement auto-initialization from script data attributes
- [ ] Set up container creation and DOM injection
- [ ] Handle multiple widget instances on same page
- [ ] Implement error handling for initialization

#### Task 2.2: Develop Main Widget Component
**Subtasks:**
- [ ] Create `src/App.jsx` main component using Preact
- [ ] Implement chat toggle button with customizable styling
- [ ] Create collapsible chat window interface
- [ ] Design message display area with proper scrolling
- [ ] Implement input field with send functionality
- [ ] Add typing indicators and loading states

#### Task 2.3: Implement Chat Functionality
**Subtasks:**
- [ ] Integrate with existing `/api/chat` endpoint
- [ ] Implement message state management
- [ ] Add error handling for API failures
- [ ] Implement retry logic for failed requests
- [ ] Add support for chat context and history
- [ ] Handle CORS configuration

#### Task 2.4: Add Configuration Loading
**Subtasks:**
- [ ] Create widget configuration API endpoint (`/api/v1/widget/config/:clientId`)
- [ ] Implement client-specific configuration loading
- [ ] Add support for theme customization (colors, fonts)
- [ ] Implement welcome message configuration
- [ ] Add fallback configuration for errors

### Phase 3: Backend API Extensions

#### Task 3.1: Create Widget Configuration Endpoint
**Subtasks:**
- [ ] Add new route `GET /api/v1/widget/config/:clientId`
- [ ] Extend client configuration JSON schema to include widget settings:
  ```json
  {
    "widgetSettings": {
      "primaryColor": "#007bff",
      "chatIcon": "💬",
      "headerText": "Chat with us!",
      "welcomeMessage": "Hello! How can I help you?",
      "position": "bottom-right",
      "autoInit": true
    }
  }
  ```
- [ ] Implement configuration validation
- [ ] Add error handling for missing configurations
- [ ] Cache configuration for performance

#### Task 3.2: Enhance Chat API for Widget Support
**Subtasks:**
- [ ] Update `/api/chat` to handle widget-specific headers
- [ ] Add widget version tracking in requests
- [ ] Implement rate limiting per client
- [ ] Add widget-specific analytics tracking
- [ ] Update CORS configuration for widget domains

#### Task 3.3: Create Widget Analytics
**Subtasks:**
- [ ] Track widget load events
- [ ] Monitor widget interaction metrics
- [ ] Add widget-specific visitor session creation
- [ ] Implement widget error logging
- [ ] Create widget performance metrics

### Phase 4: Styling & UX

#### Task 4.1: Implement Responsive Design
**Subtasks:**
- [ ] Create mobile-optimized chat interface
- [ ] Implement adaptive sizing for different screen sizes
- [ ] Add touch-friendly interactions
- [ ] Ensure proper z-index layering
- [ ] Test on various devices and browsers

#### Task 4.2: Add Theme Customization
**Subtasks:**
- [ ] Implement dynamic color theming
- [ ] Add custom font support
- [ ] Create chat bubble styling options
- [ ] Add custom icon support
- [ ] Implement dark/light mode support

#### Task 4.3: Enhance User Experience
**Subtasks:**
- [ ] Add smooth animations and transitions
- [ ] Implement proper focus management
- [ ] Add keyboard navigation support
- [ ] Create accessibility features (ARIA labels, screen reader support)
- [ ] Add sound notifications (optional)

### Phase 5: Build & Distribution

#### Task 5.1: Create Build Pipeline
**Subtasks:**
- [ ] Update root package.json with widget build scripts:
  ```json
  {
    "scripts": {
      "build:widget": "npm run build --workspace=packages/widget",
      "copy:widget": "node copy-widget.js",
      "build": "npm run build:widget && npm run build:frontend && npm run copy:widget"
    }
  }
  ```
- [ ] Create `copy-widget.js` utility script
- [ ] Configure Vercel build process to include widget
- [ ] Set up CDN distribution path

#### Task 5.2: Create Distribution Files
**Subtasks:**
- [ ] Generate `loader.js` main distribution file
- [ ] Create source maps for debugging
- [ ] Generate TypeScript definitions (optional)
- [ ] Create multiple build variants (dev/prod)
- [ ] Set up integrity hashes for security

#### Task 5.3: Implement Version Management
**Subtasks:**
- [ ] Add version tracking in widget builds
- [ ] Create backwards compatibility layer
- [ ] Implement auto-update notifications
- [ ] Add version-specific API handling
- [ ] Create migration guides for updates

### Phase 6: Integration & Documentation

#### Task 6.1: Create Integration Documentation
**Subtasks:**
- [ ] Write embedding instructions for clients
- [ ] Create configuration examples
- [ ] Document available customization options
- [ ] Add troubleshooting guides
- [ ] Create API reference for widget endpoints

#### Task 6.2: Develop Integration Examples
**Subtasks:**
- [ ] Create basic HTML integration example
- [ ] Add WordPress plugin example
- [ ] Create React/Vue.js integration guides
- [ ] Add advanced configuration examples
- [ ] Create testing tools for integration

#### Task 6.3: Client Onboarding Tools
**Subtasks:**
- [ ] Create widget preview tool
- [ ] Build configuration generator
- [ ] Add integration testing checklist
- [ ] Create client-specific embed codes
- [ ] Develop monitoring dashboard for widget usage

### Phase 7: Testing & Quality Assurance

#### Task 7.1: Unit Testing
**Subtasks:**
- [ ] Set up Jest testing framework
- [ ] Write tests for widget initialization
- [ ] Test chat functionality
- [ ] Test configuration loading
- [ ] Add error handling tests

#### Task 7.2: Integration Testing
**Subtasks:**
- [ ] Test with real client websites
- [ ] Verify cross-domain functionality
- [ ] Test API integration
- [ ] Validate performance benchmarks
- [ ] Test on multiple browsers and devices

#### Task 7.3: Security Testing
**Subtasks:**
- [ ] Audit for XSS vulnerabilities
- [ ] Validate CORS configuration
- [ ] Test CSP compatibility
- [ ] Verify data privacy compliance
- [ ] Test against common security issues

### Phase 8: Deployment & Monitoring

#### Task 8.1: Production Deployment
**Subtasks:**
- [ ] Deploy widget to production CDN
- [ ] Update DNS and SSL certificates
- [ ] Configure monitoring and alerts
- [ ] Set up error tracking
- [ ] Create rollback procedures

#### Task 8.2: Performance Monitoring
**Subtasks:**
- [ ] Implement widget load time tracking
- [ ] Monitor API response times
- [ ] Track error rates and types
- [ ] Set up usage analytics
- [ ] Create performance dashboards

#### Task 8.3: Client Support
**Subtasks:**
- [ ] Create support documentation
- [ ] Set up client notification system
- [ ] Implement widget health checks
- [ ] Create debugging tools
- [ ] Establish SLA and support processes

## 📋 Acceptance Criteria

### Functional Requirements
- [ ] Widget loads in under 500ms on 3G connection
- [ ] Bundle size remains under 20KB (gzipped)
- [ ] Successfully integrates with existing API endpoints
- [ ] Supports all major browsers (Chrome, Firefox, Safari, Edge)
- [ ] Handles up to 100 concurrent widget instances per client
- [ ] Maintains chat context across page navigation
- [ ] Gracefully handles API failures with fallback messages

### Non-Functional Requirements
- [ ] Mobile responsive on screens 320px+ wide
- [ ] Accessible to screen readers and keyboard navigation
- [ ] Secure against common web vulnerabilities
- [ ] GDPR compliant data handling
- [ ] 99.9% uptime SLA
- [ ] Sub-100ms API response times

## 🎯 Success Metrics

- **Performance**: Page load impact < 50ms
- **Adoption**: 10+ client integrations within 30 days
- **Engagement**: 25% increase in chat interactions
- **Reliability**: < 0.1% error rate
- **User Experience**: 4.5+ satisfaction rating

## 🔗 Integration Example

Final integration will look like:

```html
<!-- Basic Integration -->
<script 
  src="https://your-domain.vercel.app/widget/loader.js"
  data-client-id="client-abc"
  data-api-url="https://your-domain.vercel.app">
</script>

<!-- Advanced Integration -->
<script>
  window.initChatbotWidget({
    clientId: 'client-abc',
    apiUrl: 'https://your-domain.vercel.app',
    position: 'bottom-left',
    theme: {
      primaryColor: '#ff6b35',
      headerText: 'Need Help?'
    }
  });
</script>
```

## 📅 Timeline

- **Phase 1-2**: Weeks 1-2 (Setup & Core Development)
- **Phase 3-4**: Weeks 3-4 (Backend & Styling)
- **Phase 5-6**: Weeks 5-6 (Build & Documentation)
- **Phase 7-8**: Weeks 7-8 (Testing & Deployment)

**Total Estimated Duration**: 8 weeks

## 🚨 Risks & Mitigation

1. **Bundle Size Bloat**: Regular size monitoring, code splitting
2. **Cross-Domain Issues**: Thorough CORS testing, postMessage API
3. **Client Conflicts**: CSS isolation, namespace protection
4. **Performance Impact**: Lazy loading, minimal dependencies
5. **Security Vulnerabilities**: Regular security audits, CSP compliance

## 📝 Dependencies

- Existing backend API endpoints
- Client configuration system
- Supabase database access
- Vercel deployment pipeline
- Google AI API integration

This PRD provides a comprehensive roadmap for implementing the embeddable chatbot widget while maintaining the high standards of the existing platform.