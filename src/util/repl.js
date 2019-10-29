import readline from 'readline'

const pervasive_console = global.console
var overwritten_console = null

function proxy_console(method) {
  return function() {
    if(overwritten_console)
      overwritten_console[method].apply(overwritten_console, arguments)
    else
      pervasive_console[method].apply(pervasive_console, arguments)
  }
}

global.console = {
  log: proxy_console('log'),
  info: proxy_console('info'),
  warn: proxy_console('warn'),
  error: proxy_console('error')
}

function overwrite_console(pre, post) {
  function wrap_console(method) {
    return function() {
      pre()
      pervasive_console[method].apply(pervasive_console, arguments)
      post()
    }
  }

  overwritten_console = {
    log: wrap_console('log'),
    info: wrap_console('info'),
    warn: wrap_console('warn'),
    error: wrap_console('error')
  }
}

// TODO: fails to identify missing end delimiters
function parse_command(str) {
  if(str.length === 0) return []

  if(str[0] === '"' || str[0] === '\'') {
    var end_index
    const delim = str[0]
    str = str.slice(1)
    while(!end_index || end_index > 0 && str[end_index-1] === '\\') {
      end_index = str.slice(end_index+1).indexOf(delim)
    }
    const result = str.slice(0, end_index)
    return [result].concat(parse_command(str.slice(end_index+1)))
  }

  const index = str.indexOf(' ')
  if(index < 0) return [str]
  else if(index === 0) return parse_command(str.slice(1))
  else return [str.slice(0, index)].concat(parse_command(str.slice(index+1)))
}

export default function repl(name, intf) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${name}> `
  })

  overwrite_console(
    () => pervasive_console.log(),
    () => rl.prompt()
  )

  rl.prompt()

  return new Promise((exit_repl) => {
    rl.on('line', (line) => {
      line = line.trim()
      if(line.length === 0) {
        rl.prompt()
        return
      }

      const [cmd, ...args] = parse_command(line)
      const handler = intf[cmd]

      if(!handler) {
        console.error(`${cmd} is not a valid command`)
        rl.prompt()
      } else {
        var handler_promise
        try {
          handler_promise = handler.apply(null, args)
          if(!(handler_promise instanceof Promise))
            handler_promise = new Promise((resolve) => resolve(handler_promise))

          handler_promise
            .catch((err) =>
              console.error('ERROR:', err))
            .then((should_exit) => {
              if(should_exit) exit_repl()
              else rl.prompt()
            })
        } catch(err) {
          console.error('ERROR:', err)
        }
      }
    }).on('close', exit_repl)
  }).then(() => {overwritten_console = null})
}
