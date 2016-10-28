// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import expect = require('expect.js');

import {
  KernelMessage, Session, utils
} from '@jupyterlab/services';

import {
  Message
} from 'phosphor/lib/core/messaging';

import {
  clearSignalData, defineSignal, ISignal
} from 'phosphor/lib/core/signaling';

import {
  Widget
} from 'phosphor/lib/ui/widget';

import {
  CodeMirrorConsoleRenderer
} from '../../../lib/console/codemirror/widget';

import {
  ConsoleContent
} from '../../../lib/console/content';

import {
  ConsoleHistory
} from '../../../lib/console/history';

import {
  InspectionHandler
} from '../../../lib/inspector';

import {
  CodeCellWidget
} from '../../../lib/notebook/cells';

import {
  EdgeLocation, ICellEditorWidget, ITextChange
} from '../../../lib/notebook/cells/editor';

import {
  defaultRenderMime
} from '../utils';


class TestContent extends ConsoleContent {

  readonly edgeRequested: ISignal<this, void>;

  methods: string[] = [];

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    super.dispose();
    clearSignalData(this);
  }

  protected newPrompt(): void {
    super.newPrompt();
    this.methods.push('newPrompt');
  }

  protected onActivateRequest(msg: Message): void {
    super.onActivateRequest(msg);
    this.methods.push('onActivateRequest');
  }

  protected onAfterAttach(msg: Message): void {
    super.onAfterAttach(msg);
    this.methods.push('onAfterAttach');
  }

  protected onEdgeRequest(editor: ICellEditorWidget, location: EdgeLocation): Promise<void> {
    return super.onEdgeRequest(editor, location).then(() => {
      this.methods.push('onEdgeRequest');
      this.edgeRequested.emit(void 0);
    });
  }

  protected onTextChange(editor: ICellEditorWidget, args: ITextChange): void {
    super.onTextChange(editor, args);
    this.methods.push('onTextChange');
  }

  protected onUpdateRequest(msg: Message): void {
    super.onUpdateRequest(msg);
    this.methods.push('onUpdateRequest');
  }
}


defineSignal(TestContent.prototype, 'edgeRequested');


class TestHistory extends ConsoleHistory {
  readonly ready: ISignal<this, void>;

  dispose(): void {
    super.dispose();
    clearSignalData(this);
  }

  protected onHistory(value: KernelMessage.IHistoryReplyMsg): void {
    super.onHistory(value);
    this.ready.emit(void 0);
  }
}


defineSignal(TestHistory.prototype, 'ready');

const renderer = CodeMirrorConsoleRenderer.defaultRenderer;
const rendermime = defaultRenderMime();


describe('console/content', () => {

  describe('ConsoleContent', () => {

    let session: Session.ISession;
    let widget: TestContent;

    beforeEach(done => {
      Session.startNew({ path: utils.uuid() }).then(newSession => {
        session = newSession;
        widget = new TestContent({ renderer, rendermime, session });
        done();
      });
    });

    afterEach(done => {
      session.shutdown().then(() => {
        session.dispose();
        widget.dispose();
        done();
      }).catch(done);
    });

    describe('#constructor()', () => {

      it('should create a new console content widget', () => {
        Widget.attach(widget, document.body);
        expect(widget).to.be.a(ConsoleContent);
        expect(widget.node.classList).to.contain('jp-ConsoleContent');
      });

    });

    describe('#executed', () => {

      it('should emit a date upon execution', done => {
        let called: Date = null;
        let force = true;
        Widget.attach(widget, document.body);
        widget.executed.connect((sender, time) => { called = time; });
        widget.execute(force).then(() => {
          expect(called).to.be.a(Date);
          done();
        }).catch(done);
      });

    });

    describe('#inspectionHandler', () => {

      it('should exist after instantiation', () => {
        Widget.attach(widget, document.body);
        expect(widget.inspectionHandler).to.be.an(InspectionHandler);
      });

    });

    describe('#prompt', () => {

      it('should be a code cell widget', () => {
        Widget.attach(widget, document.body);
        expect(widget.prompt).to.be.a(CodeCellWidget);
      });

      it('should be replaced after execution', done => {
        let force = true;
        Widget.attach(widget, document.body);

        let old = widget.prompt;
        expect(old).to.be.a(CodeCellWidget);

        widget.execute(force).then(() => {
          expect(widget.prompt).to.be.a(CodeCellWidget);
          expect(widget.prompt).to.not.be(old);
          done();
        }).catch(done);
      });

    });

    describe('#session', () => {

      it('should return the session passed in at instantiation', () => {
        expect(widget.session).to.be(session);
      });

    });

    describe('#clear()', () => {

      it('should clear all of the content cells except the banner', done => {
        let force = true;
        Widget.attach(widget, document.body);
        widget.execute(force).then(() => {
          expect(widget.content.widgets.length).to.be.greaterThan(1);
          widget.clear();
          expect(widget.content.widgets.length).to.be(1);
          done();
        }).catch(done);
      });

    });

    describe('#dispose()', () => {

      it('should dispose the content widget', () => {
        Widget.attach(widget, document.body);
        expect(widget.isDisposed).to.be(false);
        widget.dispose();
        expect(widget.isDisposed).to.be(true);
      });

      it('should be safe to dispose multiple times', () => {
        Widget.attach(widget, document.body);
        expect(widget.isDisposed).to.be(false);
        widget.dispose();
        widget.dispose();
        expect(widget.isDisposed).to.be(true);
      });

    });

    describe('#execute()', () => {

      it('should execute contents of the prompt if forced', done => {
        let force = true;
        Widget.attach(widget, document.body);
        expect(widget.content.widgets.length).to.be(1);
        widget.execute(force).then(() => {
          expect(widget.content.widgets.length).to.be.greaterThan(1);
          done();
        }).catch(done);
      });

      it('should check if code is multiline and allow amending', done => {
        let force = false;
        let timeout = 9000;
        Widget.attach(widget, document.body);
        widget.prompt.model.source = 'for x in range(5):';
        expect(widget.content.widgets.length).to.be(1);
        widget.execute(force, timeout).then(() => {
          expect(widget.content.widgets.length).to.be(1);
          done();
        }).catch(done);
      });

    });

    describe('#inject()', () => {

      it('should add a code cell and execute it', done => {
        let code = 'print("#inject()")';
        Widget.attach(widget, document.body);
        expect(widget.content.widgets.length).to.be(1);
        widget.inject(code).then(() => {
          expect(widget.content.widgets.length).to.be.greaterThan(1);
          done();
        }).catch(done);
      });

    });

    describe('#insertLinebreak()', () => {

      it('should insert a line break into the prompt', () => {
        Widget.attach(widget, document.body);

        let model = widget.prompt.model;
        expect(model.source).to.be.empty();
        widget.insertLinebreak();
        expect(model.source).to.be('\n');
      });

    });

    describe('#serialize()', () => {

      it('should serialize the contents of a console', () => {
        Widget.attach(widget, document.body);
        widget.prompt.model.source = 'foo';

        let serialized = widget.serialize();
        expect(serialized).to.have.length(2);
        expect(serialized[1].source).to.be('foo');
      });

    });

    describe('#newPrompt()', () => {

      it('should be called after attach, creating a prompt', () => {
        expect(widget.prompt).to.not.be.ok();
        expect(widget.methods).to.not.contain('newPrompt');
        Widget.attach(widget, document.body);
        expect(widget.methods).to.contain('newPrompt');
        expect(widget.prompt).to.be.ok();
      });

      it('should be called after execution, creating a prompt', done => {
        expect(widget.prompt).to.not.be.ok();
        expect(widget.methods).to.not.contain('newPrompt');
        Widget.attach(widget, document.body);
        expect(widget.methods).to.contain('newPrompt');

        let old = widget.prompt;
        let force = true;
        expect(old).to.be.a(CodeCellWidget);
        widget.methods = [];

        widget.execute(force).then(() => {
          expect(widget.prompt).to.be.a(CodeCellWidget);
          expect(widget.prompt).to.not.be(old);
          expect(widget.methods).to.contain('newPrompt');
          done();
        }).catch(done);
      });

    });

    describe('#onActivateRequest()', () => {

      it('should focus the prompt editor', done => {
        expect(widget.prompt).to.not.be.ok();
        expect(widget.methods).to.not.contain('onActivateRequest');
        Widget.attach(widget, document.body);
        requestAnimationFrame(() => {
          widget.activate();
          requestAnimationFrame(() => {
            expect(widget.methods).to.contain('onActivateRequest');
            expect(widget.prompt.editor.hasFocus()).to.be(true);
            done();
          });
        });
      });

    });

    describe('#onAfterAttach()', () => {

      it('should be called after attach, creating a prompt', () => {
        expect(widget.prompt).to.not.be.ok();
        expect(widget.methods).to.not.contain('onAfterAttach');
        Widget.attach(widget, document.body);
        expect(widget.methods).to.contain('onAfterAttach');
        expect(widget.prompt).to.be.ok();
      });

    });

    describe('#onEdgeRequest()', () => {

      it('should be called upon an editor edge request', done => {
        let history = new TestHistory({ kernel: session.kernel });
        let code = 'print("#onEdgeRequest()")';
        let force = true;
        history.ready.connect(() => {
          let local = new TestContent({
            history, renderer, rendermime, session
          });
          local.edgeRequested.connect(() => {
            expect(local.methods).to.contain('onEdgeRequest');
            requestAnimationFrame(() => {
              expect(local.prompt.model.source).to.be(code);
              local.dispose();
              done();
            });
          });
          Widget.attach(local, document.body);
          requestAnimationFrame(() => {
            local.prompt.model.source = code;
            local.execute(force).then(() => {
              expect(local.prompt.model.source).to.not.be(code);
              expect(local.methods).to.not.contain('onEdgeRequest');
              local.prompt.editor.edgeRequested.emit('top');
            }).catch(done);
          });
        });
      });

    });

    describe('#onTextChange()', () => {

      it('should be called upon an editor text change', () => {
        let change: ITextChange = {
          ch: 0,
          chHeight: 0,
          chWidth: 0,
          line: 0,
          position: 0,
          coords: null,
          oldValue: 'fo',
          newValue: 'foo'
        };
        Widget.attach(widget, document.body);
        expect(widget.methods).to.not.contain('onTextChange');
        widget.prompt.editor.textChanged.emit(change);
        expect(widget.methods).to.contain('onTextChange');
      });

    });

    describe('#onUpdateRequest()', () => {

      it('should be called upon an update, after attach', done => {
        expect(widget.methods).to.not.contain('onUpdateRequest');
        Widget.attach(widget, document.body);
        requestAnimationFrame(() => {
          expect(widget.methods).to.contain('onUpdateRequest');
          done();
        });
      });

    });

  });

});
