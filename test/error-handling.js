/* eslint-env mocha */

const assert = require('assert')

const util = require('./_util')
const multer = require('../')
const stream = require('stream')
const FormData = require('form-data')

function withLimits (limits, fields) {
  var storage = multer.memoryStorage()
  return multer({ storage: storage, limits: limits }).fields(fields)
}

describe('Error Handling', () => {
  it('should respect parts limit', (done) => {
    var form = new FormData()
    var parser = withLimits({ parts: 1 }, [
      { name: 'small0', maxCount: 1 }
    ])

    form.append('field0', 'BOOM!')
    form.append('small0', util.file('small0.dat'))

    util.submitForm(parser, form, (err, req) => {
      assert.equal(err.code, 'LIMIT_PART_COUNT')
      done()
    })
  })

  it('should respect file size limit', (done) => {
    var form = new FormData()
    var parser = withLimits({ fileSize: 1500 }, [
      { name: 'tiny0', maxCount: 1 },
      { name: 'small0', maxCount: 1 }
    ])

    form.append('tiny0', util.file('tiny0.dat'))
    form.append('small0', util.file('small0.dat'))

    util.submitForm(parser, form, (err, req) => {
      assert.equal(err.code, 'LIMIT_FILE_SIZE')
      assert.equal(err.field, 'small0')
      done()
    })
  })

  it('should respect file count limit', (done) => {
    var form = new FormData()
    var parser = withLimits({ files: 1 }, [
      { name: 'small0', maxCount: 1 },
      { name: 'small1', maxCount: 1 }
    ])

    form.append('small0', util.file('small0.dat'))
    form.append('small1', util.file('small1.dat'))

    util.submitForm(parser, form, (err, req) => {
      assert.equal(err.code, 'LIMIT_FILE_COUNT')
      done()
    })
  })

  it('should respect file key limit', (done) => {
    var form = new FormData()
    var parser = withLimits({ fieldNameSize: 4 }, [
      { name: 'small0', maxCount: 1 }
    ])

    form.append('small0', util.file('small0.dat'))

    util.submitForm(parser, form, (err, req) => {
      assert.equal(err.code, 'LIMIT_FIELD_KEY')
      done()
    })
  })

  it('should respect field key limit', (done) => {
    var form = new FormData()
    var parser = withLimits({ fieldNameSize: 4 }, [])

    form.append('ok', 'SMILE')
    form.append('blowup', 'BOOM!')

    util.submitForm(parser, form, (err, req) => {
      assert.equal(err.code, 'LIMIT_FIELD_KEY')
      done()
    })
  })

  it('should respect field value limit', (done) => {
    var form = new FormData()
    var parser = withLimits({ fieldSize: 16 }, [])

    form.append('field0', 'This is okay')
    form.append('field1', 'This will make the parser explode')

    util.submitForm(parser, form, (err, req) => {
      assert.equal(err.code, 'LIMIT_FIELD_VALUE')
      assert.equal(err.field, 'field1')
      done()
    })
  })

  it('should respect field count limit', (done) => {
    var form = new FormData()
    var parser = withLimits({ fields: 1 }, [])

    form.append('field0', 'BOOM!')
    form.append('field1', 'BOOM!')

    util.submitForm(parser, form, (err, req) => {
      assert.equal(err.code, 'LIMIT_FIELD_COUNT')
      done()
    })
  })

  it('should respect fields given', (done) => {
    var form = new FormData()
    var parser = withLimits(undefined, [
      { name: 'wrongname', maxCount: 1 }
    ])

    form.append('small0', util.file('small0.dat'))

    util.submitForm(parser, form, (err, req) => {
      assert.equal(err.code, 'LIMIT_UNEXPECTED_FILE')
      assert.equal(err.field, 'small0')
      done()
    })
  })

  it('should report errors from storage engines', (done) => {
    var storage = multer.memoryStorage()

    storage._removeFile = function _removeFile (req, file, cb) {
      var err = new Error('Test error')
      err.code = 'TEST'
      cb(err)
    }

    var form = new FormData()
    var upload = multer({ storage: storage })
    var parser = upload.single('tiny0')

    form.append('tiny0', util.file('tiny0.dat'))
    form.append('small0', util.file('small0.dat'))

    util.submitForm(parser, form, (err, req) => {
      assert.equal(err.code, 'LIMIT_UNEXPECTED_FILE')
      assert.equal(err.field, 'small0')

      assert.equal(err.storageErrors.length, 1)
      assert.equal(err.storageErrors[0].code, 'TEST')
      assert.equal(err.storageErrors[0].field, 'tiny0')
      assert.equal(err.storageErrors[0].file, req.file)

      done()
    })
  })

  it('should report errors from busboy constructor', (done) => {
    var req = new stream.PassThrough()
    var storage = multer.memoryStorage()
    var upload = multer({ storage: storage }).single('tiny0')
    var body = 'test'

    req.headers = {
      'content-type': 'multipart/form-data',
      'content-length': body.length
    }

    req.end(body)

    upload({ req }, () => {})
    .catch(err => {
      assert.equal(err.message, 'Multipart: Boundary not found')
      done()
    })
  })

  it('should report errors from busboy parsing', (done) => {
    var req = new stream.PassThrough()
    var storage = multer.memoryStorage()
    var upload = multer({ storage: storage }).single('tiny0')
    var boundary = 'AaB03x'
    var body = [
      '--' + boundary,
      'Content-Disposition: form-data; name="tiny0"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      'test without end boundary'
    ].join('\r\n')

    req.headers = {
      'content-type': 'multipart/form-data; boundary=' + boundary,
      'content-length': body.length
    }

    req.end(body)

    upload({ req }, () => {})
    .catch(err => {
      assert.equal(err.message, 'Unexpected end of multipart data')
      done()
    })
  })
})
