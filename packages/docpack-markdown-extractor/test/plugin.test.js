var path = require('path');
var resolve = path.resolve;
var sinon = require('sinon');
var Docpack = require('docpack');
var tools = require('webpack-toolkit');
var Plugin = require('../lib/plugin');

var fixturesPath = resolve(__dirname, 'fixtures');

function createCompiler(plugin) {
  var plugins = [Docpack(/\.md$/)].concat(plugin ? [plugin] : []);

  var compiler = tools.InMemoryCompiler({
    context: fixturesPath,
    entry: './dummy',
    plugins: plugins
  });

  compiler.setInputFS(tools.createCachedInputFileSystem());

  return compiler;
}

function getDocpackSources(compilation) {
  return compilation.compiler.options.plugins.filter(function(plugin) {
    return plugin instanceof Docpack;
  })[0].sources;
}

describe('docpack-markdown-extractor', () => {
  it('should export static props', () => {
    Plugin.should.have.property('defaultConfig').and.be.an('object');
  });

  describe('constructor()', () => {
    it('should throw when wrong arguments', () => {
      (() => Plugin()).should.throw();
      (() => Plugin({files: 4})).should.throw();
      (() => Plugin({files: {}})).should.throw();
      (() => Plugin({files: '*.md'})).should.not.throw();
      (() => Plugin({files: []})).should.not.throw();
    });
  });

  describe('configure()', () => {
    describe('`files` option', () => {
      describe('Glob wildcard as string', () => {
        it('should throw it no files found', () => {
          (() => createCompiler(Plugin({files: '1/*.md'}))).should.throw();
        });

        it('should convert to absolute paths', () => {
          var plugin = Plugin({files: '*.md'});
          (() => createCompiler(plugin)).should.not.throw();
          plugin.files.should.be.lengthOf(2);
          plugin.files[0].should.be.equal(resolve(fixturesPath, './test1.md'));
          plugin.files[1].should.be.equal(resolve(fixturesPath, './test2.md'));
        });
      });

      describe('List of files as array', () => {
        it('should convert to absolute paths', () => {
          var plugin = Plugin({files: [
            resolve(fixturesPath, './test1.md'),
            './test2.md'
          ]});

          createCompiler(plugin);

          plugin.files.should.be.lengthOf(2);
          plugin.files[0].should.be.equal(resolve(fixturesPath, './test1.md'));
          plugin.files[1].should.be.equal(resolve(fixturesPath, 'test2.md'));
        });
      });
    });

    it('should add each markdown file as entry point to compiler', (done) => {
      createCompiler(Plugin({files: '*.md'})).run()
        .then(compilation => {
          var md = compilation.entries.filter(m => m.resource.endsWith('.md'));

          md.should.be.lengthOf(2);
          md[0].resource.should.be.equal(resolve(fixturesPath, 'test1.md'));
          md[1].resource.should.be.equal(resolve(fixturesPath, 'test2.md'));

          var loader = md[0].loaders[0];
          loader = typeof loader === 'string' ? {loader: loader} : loader;

          tools.stringifyLoaderConfig(loader).should.contain('null-loader');
          done();
        })
        .catch(done);
    });
  });

  describe('apply()', () => {
    it('should emit assets if markdown file exist in `files`', () => {
      return createCompiler(Plugin({files: '*.md'})).run()
        .then(compilation => {
          var assets = compilation.assets;
          assets.should.have.property('test1.md.js');
          assets.should.have.property('test2.md.js');
        });
    });

    it('should properly use `match` option', (done) => {
      var plugin = Plugin({files: '*.md', match: /test1\.md$/});

      createCompiler(plugin).run()
        .then(compilation => {
          var sources = getDocpackSources(compilation);
          sources.should.be.lengthOf(2);
          sources[0].attrs.should.have.property('title').and.be.equal('qwe');
          sources[1].attrs.should.be.empty;
          done();
        })
        .catch(done);
    });
  });
});
