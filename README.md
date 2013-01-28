Bilder Demo is a part of Bilder, a Master's Thesis project by two students at
Chalmers University of Technology. See the appropriate README for
[Bilder](https://github.com/ingemaradahl/bilder) for an more in-depth
explanation of what that is.

This demo platform is mostly a set of quick and dirty hacks to try out the
Bilder compiler from a web page, using WebGL to render the Bilder filters, so
don't expect quality code.

## Live demo
A live version is available at [http://bilder.htn.se](http://bilder.htn.se).
Please send us a message if something isn't working with it!

## Installation
A few submodules are used, so use `--recursive` when cloning:

    git clone --recursive git@github.com:ingemaradahl/bilder-demo.git

When git has finished loading all that stuff, either drop your clone where your
web server can reach it, or use the provided python server script (uses port
8080 by default):

    python3 server.py

and point your browser to [`http://localhost:8080/`](http://localhost:8080)`

### Compiler
Before you can hit compile, you need to install the compiler. You can either get
the [code](https://github.com/ingemaradahl/bilder "Bilder Compiler") for it and
build it yourself, or get a [binary](http://bilder.htn.se/builds) already built
for you (no guarantees that anything will work though!).

Which ever option you go for, drop the `cgibildc` binary in the `cmp/`
directory.  (Don't forget to make it executable; `chmod +x cgibildc` should do
the trick)

If you're using your own web server, don't forget to configure it to recognise
`cgicomp` as a cgi executable (...or just use the python server).

## Licence
The Bilder Demo platform (and the Bilder Compiler) is licensed under the GNU
Lesser General Public License, see LICENSE for more information.
