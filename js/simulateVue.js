/***************simulateVue.js**********/

// 
/**
 * @description: 声明vue函数
 * @param ：{options:}
 * @return: 无
 * @author: herry
 * @Date: 2020年7月18日11:52:13
 */
function SimulateVue(options) {
	var vm = this;
	this.data = options.data;
	this.methods = options.methods;
	// 返回一个给定对象的自身枚举属性组成数组，组中属性名排序和遍历返回顺序一致
	Object.keys(this.data).forEach(function(key) {
		vm.proxyKeys(key); // 绑定代理属性
	});

	observe(this.data);
	new Compile(options.el, this);
	options.mounted.call(this); // 所有事情处理好后执行mounted函数,call为调用mounted方法
}

/**
 * @description: 添加proxyKeys方法：添加data值
 * @param ：{options:}
 * @return: 无
 * @author: herry
 * @Date: 2020年7月18日11:52:13
 */
SimulateVue.prototype = {
	proxyKeys: function(key) {
		var vm = this;
		// defineProperty直接在Object对象定义一个新的属性或修改现有属性
		Object.defineProperty(this, key, {
			// enumerable为true时候出现在对象的枚举属性中,默认false
			enumerable: false,
			// configurable为true时候可以修改值,并可删除
			configurable: true,
			get: function getter() {
				return vm.data[key];
			},
			set: function setter(newVal) {
				vm.data[key] = newVal;
			}
		});
	}
}


/***************监听器observer.js**********/
/*** 劫持并监听所有属性，如有变动则通知订阅者 ***/

// 创建Observer对象及属性data和walk
function Observer(data) {
	this.data = data;
	this.walk(data);
}

// 向Observer对象添加方法
Observer.prototype = {
	// 添加walk方法： 遍历data里面的值
	walk: function(data) {
		var vm = this;
		//Object.keys(data):返回一个所有元素为字符串的数组，其元素来自于从给定的object上面可直接枚举的属性。这些属性的顺序与手动遍历该对象属性时的一致。
		Object.keys(data).forEach(function(key) {
			vm.defineReactive(data, key, data[key]);
		});
	},
	// 添加defineReactive方法
	defineReactive: function(data, key, val) {
		var dep = new Dep();
		var childObj = observe(val);
		Object.defineProperty(data, key, {
			enumerable: true,
			configurable: true,
			get: function getter() {
				if (Dep.target) {
					dep.addSub(Dep.target);
				}
				return val;
			},
			set: function setter(newVal) {
				if (newVal === val) {
					return;
				}
				val = newVal;
				dep.notify();
			}
		});
	}
};

// 如果传入有值且是对象则new一个Observer对象
var observe = function(value, vm) {
	if (!value || typeof value !== 'object') {
		return;
	}
	return new Observer(value);
};

// 消息订阅器：收集订阅者在Observer和Watcher进行统一管理
function Dep() {
	this.subs = [];
}
Dep.prototype = {
	addSub: function(sub) {
		this.subs.push(sub);
	},
	notify: function() {
		this.subs.forEach(function(sub) {
			sub.update();
		});
	}
};


// 触发事件元素置null
Dep.target = null;




/***************watcher.js**********/
/**** 接收到属性的变化通知并执行相应的函数，更新view ****/
function Watcher(vm, exp, cb) {
	this.cb = cb;
	this.vm = vm;
	this.exp = exp;
	this.value = this.get(); // 将自己添加到订阅器的操作
}

Watcher.prototype = {
	update: function() {
		this.run();
	},
	run: function() {
		var value = this.vm.data[this.exp];
		var oldVal = this.value;
		if (value !== oldVal) {
			this.value = value;
			this.cb.call(this.vm, value, oldVal);
		}
	},
	get: function() {
		Dep.target = this; // 缓存自己
		var value = this.vm.data[this.exp] // 强制执行1监听器里的get函数
		Dep.target = null; // 释放自己
		return value;
	}
};


/***************解析器compile.js**********/
/*** 扫描和解析每个节点的相关指令，根据初始化模块数据以及初始化相应的订阅器 ***/
function Compile(el, vm) {
	this.vm = vm;
	this.el = document.querySelector(el); // 获取第一个元素
	this.fragment = null;
	this.init();
}

Compile.prototype = {
	init: function() {
		if (this.el) {
			this.fragment = this.nodeToFragment(this.el);
			this.compileElement(this.fragment);
			this.el.appendChild(this.fragment);
		} else {
			console.log('Dom元素不存在');
		}
	},

	// 将操作的dom存储到fragment中
	nodeToFragment: function(el) {
		// 创建虚拟节点对象(包含所有属性和方法)
		var fragment = document.createDocumentFragment();
		//返回被选节点的第一个子节点
		var child = el.firstChild;
		while (child) {
			// 将Dom元素移入fragment中
			fragment.appendChild(child);
			child = el.firstChild;
		}
		return fragment;
	},

	// 解析{{}}形式的内容
	compileElement: function(el) {
		var childNodes = el.childNodes;
		var self = this;
		[].slice.call(childNodes).forEach(function(node) {
			var reg = /\{\{(.*)\}\}/;
			var text = node.textContent;

			if (self.isElementNode(node)) {
				self.compile(node);
			} else if (self.isTextNode(node) && reg.test(text)) {
				self.compileText(node, reg.exec(text)[1]);
			}

			if (node.childNodes && node.childNodes.length) {
				self.compileElement(node);
			}
		});
	},
	compileText: function(node, exp) {
		var self = this;
		var initText = this.vm[exp];
		this.updateText(node, initText); // 将初始化数据初始化到视图中
		new Watcher(this.vm, exp, function(value) { // 生成订阅器绑定更新函数
			self.updateText(node, value);
		});
	},

	// 解析指令
	compile: function(node) {
		var nodeAttrs = node.attributes;
		var self = this;
		Array.prototype.forEach.call(nodeAttrs, function(attr) {
			var attrName = attr.name;
			if (self.isDirective(attrName)) {
				var exp = attr.value;
				var dir = attrName.substring(2);
				if (self.isEventDirective(dir)) { // 事件指令
					self.compileEvent(node, self.vm, exp, dir);
				} else { // v-model 指令
					self.compileModel(node, self.vm, exp, dir);
				}
				node.removeAttribute(attrName);
			}
		});
	},

	compileEvent: function(node, vm, exp, dir) {
		var eventType = dir.split(':')[1];
		var cb = vm.methods && vm.methods[exp];

		if (eventType && cb) {
			node.addEventListener(eventType, cb.bind(vm), false);
		}
	},
	compileModel: function(node, vm, exp, dir) {
		var self = this;
		var val = this.vm[exp];
		this.modelUpdater(node, val);
		new Watcher(this.vm, exp, function(value) {
			self.modelUpdater(node, value);
		});

		node.addEventListener('input', function(e) {
			var newValue = e.target.value;
			if (val === newValue) {
				return;
			}
			self.vm[exp] = newValue;
			val = newValue;
		});
	},
	updateText: function(node, value) {
		node.textContent = typeof value == 'undefined' ? '' : value;
	},
	modelUpdater: function(node, value, oldValue) {
		node.value = typeof value == 'undefined' ? '' : value;
	},
	isDirective: function(attr) {
		return attr.indexOf('v-') == 0;
	},
	isEventDirective: function(dir) {
		return dir.indexOf('on:') === 0;
	},
	isElementNode: function(node) {
		return node.nodeType == 1;
	},
	isTextNode: function(node) {
		return node.nodeType == 3;
	}
}
