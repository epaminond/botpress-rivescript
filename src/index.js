import path from 'path'
import fs from 'fs-extra'

import RiveScript from 'rivescript'

var rs = null

const validateRiveName = (name) => /[A-Z0-9_-]+/i.test(name)

module.exports = {
  incoming: function(event, next) {
    if (event.platform === 'facebook') {
      const reply = rs.reply(event.user.id, event.text)
      event.skin.messenger.pipeText(event.user.id, reply)
    } else {
      throw new Error('Unsupported platform: ', event.platform)
    }
    next()
  },
  outgoing: function(event, next) {

  },
  init: function(skin) {},
  ready: function(skin) {

    const riveDirectory = path.join(skin.dataLocation, 'rivescript')

    if (!fs.existsSync(riveDirectory)) {
      fs.mkdirSync(riveDirectory)
      fs.copySync(path.join(__dirname, '../templates'), riveDirectory)
    }

    const reloadRiveScript = () => {
      rs = new RiveScript()

      rs.loadDirectory(riveDirectory, (batchNumber) => {
        rs.sortReplies()
      }, (err) => {
        console.log('Error', err) // TODO clean that
      })
    }

    reloadRiveScript()

    const router = skin.getRouter('skin-rivescript')

    router.get('/scripts', (req, res, next) => {
      const data = {}
      const files = fs.readdirSync(riveDirectory)
      for (let file of files) {
        const name = file.replace(/\.rive$/, '')
        const content = fs.readFileSync(path.join(riveDirectory, file)).toString()
        data[name] = content
      }
      res.send(data)
    })

    router.delete('/scripts/:name', (req, res, next) => {
      const { name } = req.params

      if (!name || name.length <= 0 || !validateRiveName(name)) {
        throw new Error('Invalid rivescript name: ' + name)
      }

      const filePath = path.join(riveDirectory, name + '.rive')

      if (!fs.existsSync(filePath)) {
        throw new Error("This script doesn't exist")
      }

      fs.unlinkSync(filePath)

      reloadRiveScript()
      
      res.sendStatus(200)
    })

    // create a new script
    router.post('/scripts', (req, res, next) => {
      const { name, content, overwrite } = req.body

      if (!name || name.length <= 0 || !validateRiveName(name)) {
        throw new Error('Invalid rivescript name: ' + name)
      }

      const filePath = path.join(riveDirectory, name + '.rive')

      if (!overwrite && fs.existsSync(filePath)) {
        throw new Error("Can't overwrite script: " + name)
      }

      fs.writeFileSync(filePath, content)

      reloadRiveScript()

      res.sendStatus(200)
    })

    router.post('/reset', (req, res, next) => {
      reloadRiveScript()
      res.sendStatus(200)
    })

    router.post('/simulate', (req, res, next) => {
      const { text } = req.body
      res.send(rs.reply('local-user', text))
    })

  }
}
