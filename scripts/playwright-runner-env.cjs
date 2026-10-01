// Browser installation and test workers must resolve the same cache on Linux.
// The application server still receives its own isolated XDG_CACHE_HOME.
exports.runnerEnvironment = function runnerEnvironment(serverEnvironment) {
  return Object.fromEntries(Object.entries(serverEnvironment).filter(([key]) => key !== 'XDG_CACHE_HOME'));
};
