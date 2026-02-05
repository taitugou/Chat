import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import pxtorem from 'postcss-pxtorem'

function discardUnitFromZero() {
  return {
    postcssPlugin: 'discard-unit-from-zero',
    Declaration(decl) {
      decl.value = decl.value.replace(/\b0px\b/g, '0')
    },
    AtRule(atRule) {
      atRule.params = atRule.params.replace(/\b0px\b/g, '0')
    },
  }
}
discardUnitFromZero.postcss = true

export default {
  plugins: [
    tailwindcss(),
    autoprefixer(),
    pxtorem({
      rootValue: 16,
      unitPrecision: 5,
      propList: ['*'],
      selectorBlackList: [],
      replace: true,
      mediaQuery: true,
      minPixelValue: 0,
    }),
    discardUnitFromZero(),
  ],
}

