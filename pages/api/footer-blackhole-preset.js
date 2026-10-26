import {createFooterPresetHandler} from '../../lib/footerBlackHoleProjectStore'

export const config={api:{bodyParser:{sizeLimit:'32kb'}}}
export default createFooterPresetHandler({development:process.env.NODE_ENV==='development'})
