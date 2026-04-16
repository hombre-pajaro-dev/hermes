module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'features/support/hooks.ts',
      'features/support/world.ts',
      'features/step_definitions/**/*.steps.ts'
    ],
    format: [
      'progress-bar',
      'html:report/cucumber-report.html'
    ],
    paths: ['features/**/*.feature'],
    publishQuiet: true
  }
};
