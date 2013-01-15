#!/usr/bin/env python
# -*- coding: utf-8 -*-

from http.server import CGIHTTPRequestHandler, HTTPServer
import os

HOST = ''
PORT = 8080


class RequestHandler(CGIHTTPRequestHandler):
    # source in http://hg.python.org/cpython/file/3.3/Lib/http/server.py
    cgi_directories = ["/cmp/"]

    def do_POST(self):
        # set up "fake" chrooted CGI directory.
        self.cgi_directories = ["/"]
        cdir = os.path.abspath(os.curdir)
        os.chdir('cmp/')

        # fake the path to the compiler.
        self.path = self.path.split("/", 2)[2]

        # try to run the CGI program.
        CGIHTTPRequestHandler.do_POST(self)

        # restore.
        os.chdir(cdir)
        self.cgi_directories = ["/cmp/"]


httpd = HTTPServer((HOST, PORT), RequestHandler)
httpd.serve_forever()
