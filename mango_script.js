function createMango(options){
	/* This file is part of OWL JavaScript Utilities.

	OWL JavaScript Utilities is free software: you can redistribute it and/or 
	modify it under the terms of the GNU Lesser General Public License
	as published by the Free Software Foundation, either version 3 of
	the License, or (at your option) any later version.

	OWL JavaScript Utilities is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Lesser General Public License for more details.

	You should have received a copy of the GNU Lesser General Public 
	License along with OWL JavaScript Utilities.  If not, see 
	<http://www.gnu.org/licenses/>.
	*/

	if(owl == undefined)		
	var owl = (function() {

		// the re-usable constructor function used by clone().
		function Clone() {}

		// clone objects, skip other types.
		function clone(target) {
			if ( typeof target == 'object' ) {
				Clone.prototype = target;
				return new Clone();
			} else {
				return target;
			}
		}


		// Shallow Copy 
		function copy(target) {
			if (typeof target !== 'object' ) {
				return target;  // non-object have value sematics, so target is already a copy.
			} else {
				var value = target.valueOf();
				if (target != value) { 
					// the object is a standard object wrapper for a native type, say String.
					// we can make a copy by instantiating a new object around the value.
					return new target.constructor(value);
				} else {
					// ok, we have a normal object. If possible, we'll clone the original's prototype 
					// (not the original) to get an empty object with the same prototype chain as
					// the original.  If just copy the instance properties.  Otherwise, we have to 
					// copy the whole thing, property-by-property.
					if ( target instanceof target.constructor && target.constructor !== Object ) { 
						var c = clone(target.constructor.prototype);
					
						// give the copy all the instance properties of target.  It has the same
						// prototype as target, so inherited properties are already there.
						for ( var property in target) { 
							if (target.hasOwnProperty(property)) {
								c[property] = target[property];
							} 
						}
					} else {
						var c = {};
						for ( var property in target ) c[property] = target[property];
					}
					
					return c;
				}
			}
		}

		// Deep Copy
		var deepCopiers = [];

		function DeepCopier(config) {
			for ( var key in config ) this[key] = config[key];
		}
		DeepCopier.prototype = {
			constructor: DeepCopier,

			// determines if this DeepCopier can handle the given object.
			canCopy: function(source) { return false; },

			// starts the deep copying process by creating the copy object.  You
			// can initialize any properties you want, but you can't call recursively
			// into the DeeopCopyAlgorithm.
			create: function(source) { },

			// Completes the deep copy of the source object by populating any properties
			// that need to be recursively deep copied.  You can do this by using the
			// provided deepCopyAlgorithm instance's deepCopy() method.  This will handle
			// cyclic references for objects already deepCopied, including the source object
			// itself.  The "result" passed in is the object returned from create().
			populate: function(deepCopyAlgorithm, source, result) {}
		};

		function DeepCopyAlgorithm() {
			// copiedObjects keeps track of objects already copied by this
			// deepCopy operation, so we can correctly handle cyclic references.
			this.copiedObjects = [];
			thisPass = this;
			this.recursiveDeepCopy = function(source) {
				return thisPass.deepCopy(source);
			}
			this.depth = 0;
		}
		DeepCopyAlgorithm.prototype = {
			constructor: DeepCopyAlgorithm,

			maxDepth: 256,
				
			// add an object to the cache.  No attempt is made to filter duplicates;
			// we always check getCachedResult() before calling it.
			cacheResult: function(source, result) {
				this.copiedObjects.push([source, result]);
			},

			// Returns the cached copy of a given object, or undefined if it's an
			// object we haven't seen before.
			getCachedResult: function(source) {
				var copiedObjects = this.copiedObjects;
				var length = copiedObjects.length;
				for ( var i=0; i<length; i++ ) {
					if ( copiedObjects[i][0] === source ) {
						return copiedObjects[i][1];
					}
				}
				return undefined;
			},
			
			// deepCopy handles the simple cases itself: non-objects and object's we've seen before.
			// For complex cases, it first identifies an appropriate DeepCopier, then calls
			// applyDeepCopier() to delegate the details of copying the object to that DeepCopier.
			deepCopy: function(source) {
				// null is a special case: it's the only value of type 'object' without properties.
				if ( source === null ) return null;

				// All non-objects use value semantics and don't need explict copying.
				if ( typeof source !== 'object' ) return source;

				var cachedResult = this.getCachedResult(source);

				// we've already seen this object during this deep copy operation
				// so can immediately return the result.  This preserves the cyclic
				// reference structure and protects us from infinite recursion.
				if ( cachedResult ) return cachedResult;

				// objects may need special handling depending on their class.  There is
				// a class of handlers call "DeepCopiers"  that know how to copy certain
				// objects.  There is also a final, generic deep copier that can handle any object.
				for ( var i=0; i<deepCopiers.length; i++ ) {
					var deepCopier = deepCopiers[i];
					if ( deepCopier.canCopy(source) ) {
						return this.applyDeepCopier(deepCopier, source);
					}
				}
				// the generic copier can handle anything, so we should never reach this line.
				throw new Error("no DeepCopier is able to copy " + source);
			},

			// once we've identified which DeepCopier to use, we need to call it in a very
			// particular order: create, cache, populate.  This is the key to detecting cycles.
			// We also keep track of recursion depth when calling the potentially recursive
			// populate(): this is a fail-fast to prevent an infinite loop from consuming all
			// available memory and crashing or slowing down the browser.
			applyDeepCopier: function(deepCopier, source) {
				// Start by creating a stub object that represents the copy.
				var result = deepCopier.create(source);

				// we now know the deep copy of source should always be result, so if we encounter
				// source again during this deep copy we can immediately use result instead of
				// descending into it recursively.  
				this.cacheResult(source, result);

				// only DeepCopier::populate() can recursively deep copy.  So, to keep track
				// of recursion depth, we increment this shared counter before calling it,
				// and decrement it afterwards.
				this.depth++;
				if ( this.depth > this.maxDepth ) {
					throw new Error("Exceeded max recursion depth in deep copy.");
				}

				// It's now safe to let the deepCopier recursively deep copy its properties.
				deepCopier.populate(this.recursiveDeepCopy, source, result);

				this.depth--;

				return result;
			}
		};

		// entry point for deep copy.
		//   source is the object to be deep copied.
		//   maxDepth is an optional recursion limit. Defaults to 256.
		function deepCopy(source, maxDepth) {
			var deepCopyAlgorithm = new DeepCopyAlgorithm();
			if ( maxDepth ) deepCopyAlgorithm.maxDepth = maxDepth;
			return deepCopyAlgorithm.deepCopy(source);
		}

		// publicly expose the DeepCopier class.
		deepCopy.DeepCopier = DeepCopier;

		// publicly expose the list of deepCopiers.
		deepCopy.deepCopiers = deepCopiers;

		// make deepCopy() extensible by allowing others to 
		// register their own custom DeepCopiers.
		deepCopy.register = function(deepCopier) {
			if ( !(deepCopier instanceof DeepCopier) ) {
				deepCopier = new DeepCopier(deepCopier);
			}
			deepCopiers.unshift(deepCopier);
		}

		// Generic Object copier
		// the ultimate fallback DeepCopier, which tries to handle the generic case.  This
		// should work for base Objects and many user-defined classes.
		deepCopy.register({
			canCopy: function(source) { return true; },

			create: function(source) {
				if ( source instanceof source.constructor ) {
					return clone(source.constructor.prototype);
				} else {
					return {};
				}
			},

			populate: function(deepCopy, source, result) {
				for ( var key in source ) {
					if ( source.hasOwnProperty(key) ) {
						result[key] = deepCopy(source[key]);
					}
				}
				return result;
			}
		});

		// Array copier
		deepCopy.register({
			canCopy: function(source) {
				return ( source instanceof Array );
			},

			create: function(source) {
				return new source.constructor();
			},

			populate: function(deepCopy, source, result) {
				for ( var i=0; i<source.length; i++) {
					result.push( deepCopy(source[i]) );
				}
				return result;
			}
		});

		// Date copier
		deepCopy.register({
			canCopy: function(source) {
				return ( source instanceof Date );
			},

			create: function(source) {
				return new Date(source);
			}
		});

		// HTML DOM Node

		// utility function to detect Nodes.  In particular, we're looking
		// for the cloneNode method.  The global document is also defined to
		// be a Node, but is a special case in many ways.
		function isNode(source) {
			if ( window.Node ) {
				return source instanceof Node;
			} else {
				// the document is a special Node and doesn't have many of
				// the common properties so we use an identity check instead.
				if ( source === document ) return true;
				return (
					typeof source.nodeType === 'number' &&
					source.attributes &&
					source.childNodes &&
					source.cloneNode
				);
			}
		}

		// Node copier
		deepCopy.register({
			canCopy: function(source) { return isNode(source); },

			create: function(source) {
				// there can only be one (document).
				if ( source === document ) return document;

				// start with a shallow copy.  We'll handle the deep copy of
				// its children ourselves.
				return source.cloneNode(false);
			},

			populate: function(deepCopy, source, result) {
				// we're not copying the global document, so don't have to populate it either.
				if ( source === document ) return document;

				// if this Node has children, deep copy them one-by-one.
				if ( source.childNodes && source.childNodes.length ) {
					for ( var i=0; i<source.childNodes.length; i++ ) {
						var childCopy = deepCopy(source.childNodes[i]);
						result.appendChild(childCopy);
					}
				}
			}
		});

		return {
			DeepCopyAlgorithm: DeepCopyAlgorithm,
			copy: copy,
			clone: clone,
			deepCopy: deepCopy
		};
	})();
// END OF OWL Javascript utilities
/**
	Mango Script, Created by: Daniel Boros

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
	
**/

    function getType(val){
        var type = typeof(val);
        if(type == 'object'){
            if(val.constructor == Array)
                return 'array';
            if(val.constructor == Date)
                return 'date';
            if(val.constructor == RegExp)
                return 'regexp';
            return 'object';
        }   
        return type;
    }
    function testNum(val){
        var type = getType(val);
        if(type == 'number')
            return true
        if(type == 'string')
            return /-?\d+\.?\d+/.test(val);
        return false;
    }
    function $exists(val1,val2){
        if((val2 != undefined)===val1)
            return true;
        return false;
    }
    function $mod(val1,val2){
        if(getType(val1) != 'array' || val1.length!=2 || !testNum(val1[0]) || !testNum(val1[1]))
            return false;     
        if(val2 == undefined || !testNum(val2))
            return false;
        return (val2 % val1[0] == val1[1]);
    }  
    function $eq(val1,val2,rec){
        var type = getType(val1);
        var type2 = getType(val2);        
        if(type != 'array' && type2 == 'array')
            return $in(val2,val1);
        if(type == 'regexp')
            return val1.test(val2);            
        if(type == 'array' || type == 'object'){            
            if(rec != undefined){
                for(var i=0,l=rec.length;i<l;i++)
                    if(rec[i][0]==val1)
                        if(val1 == val2 || val1 == rec[i][0]){
                            return true;
                        } else
                            return false;
                rec.push([val1,val2]);
            }
        }
        if(type == 'array'){            
            if(val1.length != val2.length)
                return false;                               
            for(var i=0,l=val1.length;i<l;i++)
                if(!$eq(val1[i],val2[i],rec))
                    return false;
            return true;
        }
        if(type == 'object'){
            if(type2 != 'object')
                return false;
            var count1 = 0,count2 = 0;
            for(var attr in val1){
                if(!$eq(val1[attr],val2[attr],rec))
                    return false;
                count1++;
            }
            for(var attr in val2)
                count2++;
            if(count1 != count2)
                return false;
            return true;
        }        
        if(val1 == val2)
            return true;
        return false;
    }
    function $ne(val1,val2){
        return !$eq(val1,val2);
    }
    function $gt(val1,val2){
        if(val2 != undefined && testNum(val1) && testNum(val2))
            return (val1<val2);
        return false;
    }    
    function $lt(val1,val2){
        if(val2 != undefined && testNum(val1) && testNum(val2))
            return (val1>val2);
        return false;
    }    
    function $gte(val1,val2){
        if(val2 != undefined && testNum(val1) && testNum(val2))
            return (val1<=val2);
        return false;
    }
    function $lte(val1,val2){
        if(val2 != undefined && testNum(val1) && testNum(val2))
            return (val1>=val2);
        return false;
    }
    function $in(arr,val){
        if(getType(arr)!='array')
           return false;
        for(var i=0,l=arr.length;i<l;i++)
            if($eq(val,arr[i])){
                if($saveIndex == -1)
                    $saveIndex = i;
                return true;
            }
        return false;
    }
    function $nin(arr,val){
        return !$in(arr,val);
    }
    function $all(arr,arr2){
        if(getType(arr)!='array')
            return false
        for(var i=0,l=arr.length;i<l;i++)
            if($nin(arr2,arr[i]))
                return false;
        return true;
    }
    function $elemMatch(obj,arr){
        if(getType(obj)!='object' || getType(arr)!='array')
            return false;        
        var saveOr = $or, saveNor = $nor;
        $or = false;
        $nor = false;
        //var arrGet = returnObj.find(arr,obj);
        var ret = false;
        for(var i=0,l=arr.length;i<l;i++)
            if(returnObj.find([arr[i]],obj).length>0){
                ret = true;
                break;
            }
        $or = saveOr;
        $nor = saveNor;
        return ret;
    }
    function $not(obj,val){
        if(getType(obj)!='object')
            return !($eq(obj,val,[]));
        else            
            for(var attr in obj)
                if($mongo[attr]==undefined)
                    return !($eq(obj,val,[]));
                else
                    return !($mongo[attr](obj[attr],val));
    }
    function $size(val,arr){
        if(!testNum(val) || getType(arr)!='array')
            return false;
        if(arr.length == (val*1))
            return true;
        return false;
    }
    function $type(val1,val2){        
        if(!testNum(val1))
            return false;        
        var type = getType(val2);
        if(type == 'number'){           
            if(Math.round(val2)==val2)
                return (val1==18 || val1==16);
            else
                return (val1==1);
        }        
        var obj = {'boolean':8,'string':2,'object':3,'array':4, 'date':9,'regexp':11,'function':15};
        if(obj[type]!=undefined)
            return (val1==obj[type]);
        return false;        
    }
    function $where(val1,val2){
        if($opt.leteval===false)
            throw 'Eval is not On!';
        function doit(v2){
            return eval('('+v2+');');
        }
        if(getType(val1)!='string')
            return false;
        var bl = doit.call(val2,val1);
        if(bl === true)
            return true;
        return false;
    }
    function $regex(regex,options,val2){
        var reg;
        if(getType(regex)!='regexp')
            reg = new RegExp(regex,options);
        else
            reg = regex;
        return reg.test(val2);
    }
    function _in(arr,val){        
        for(var i=0,l=arr.length;i<l;i++)
            if(arr[i]===val)
                return true;                   
        return false;
    }
    function testOrder(val1,val2,rec){
        var type1 = getType(val1);
        var type2 = getType(val2);
        if(type1 != type2)
            return 0;
        if(type1 == 'array'){
            if(rec == undefined)
                 rec = [];
             for(var i=0,l=rec.length;i<l;i++)
                 if(rec[i][0]==use1)
                     return 0;
             rec.push([val1]);
             rec.push([val2]);
            var use1=val1,use2=val2;
            if(val1.length>val2.length){
                use1=val2;
                use2=val1;
            }
             for(var i=0;i<use1.length;i++){
                var res = testOrder(use1[i],use2[i],res);
                if(res != 0)
                    return res;
            }
            return 0;
        }
        if(type1 == 'object'){
            if(rec == undefined)
                 rec = [];
             for(var i=0,l=rec.length;i<l;i++)
                 if(rec[i][0]==use1)
                     return 0;
             rec.push([val1]);
             rec.push([val2]);
             var l1 = 0,l2 = 0;
            for(var attr in val1){
                if(val2[attr] == undefined)
                    return 0;
                l1++;
            }
            for(var attr in val2)
                if(l2>=l1)
                    return 0;
                else
                    l2++;
            for(var attr in val1){
                var res = testOrder(val1[attr],val2[attr],res);
                 if(res != 0)
                     return res;
            }
            return 0;
        }
        if(val1>val2)
            return 1;
        if(val1==val2)
            return 0;
        return -1;
    }
    function sort(arr,obj){
         if(getType(obj)!='object')
             return;
         function sortFunc(a,b){
            var res = 0;
             for(var attr in obj){
                 var arrAttr = attr.split('.');
                 var useA = a, useB = b;
                 for(var i=0;i<arrAttr.length;i++){
                     useA = useA[arrAttr[i]];
                     useB = useB[arrAttr[i]];
                 }      
                res = testOrder(useA,useB);
                if(obj[attr]==-1)
                    res = res*-1;
                if(res != 0)
                    break;
             }
            return res;
         }
         return arr.sort(sortFunc);
     }
    function remove(query){
        var saveFunc = $copyFunc;
        $copyFunc = superAwesomeCopy;                
        var base = returnObj.find(this,query);
        $copyFunc = saveFunc;        
        for(var i=0,l=base.length;i<l;i++)
            for(var e=0,l2=this.length;e<l2;e++)
                if(base[i] == this[e]){
                    this.splice(e,1);                    
                    break;
                }
        return this;
    }
    function insert(doc){        
		var type = getType(doc);
        if(type != 'array' && type != 'object')       
            throw 'type of doc must be array or object!';
        if(type == 'array'){
            for(var i=0,l=doc.length;i<l;i++)
				if(getType(doc[i])=='object')
					this.push(doc[i]);
        } else
            if(type == 'object')
                this.push(doc);
        return this;
    }     
    function findOne(query){
        var res = returnObj.find(this,query,{limit:1});
        return res[0];
    }
    function update(query,doc,options){
        $saveIndex = -1;
        var saveFunc = $copyFunc;
        $copyFunc = superAwesomeCopy;                
        var base = returnObj.find(this,query);
        $copyFunc = saveFunc;
        var arrFind = [];
        for(var i=0,l=base.length;i<l;i++)
            for(var e=0,l2=this.length;e<l2;e++)
                if(base[i] === this[e]){
                    arrFind.push(e);
                    break;
                }
        var isAtomic = true;
        for(var attr in doc)
            if($atomic[attr]!=1){
                isAtomic = false;
                break;
            }     
        var target;
        if(base.length != 0)
            target = [arrFind[0]];
        if(options != undefined){
            if(options.upsert === true && arrFind.length == 0){
                var l = this.push({});
                target = [l-1];
            } else                 
                if(options.multi === true)
                    target = arrFind;
        }
        if(getType(target) != 'array' || target.length == 0)
            return this;
        var arrTest = ['$push','$pushAll','$addToSet','$pop','$pull','pullAll'];       
        for(var i=0,l=target.length;i<l;i++){
            if(isAtomic){
                for(var attr in doc){    
                    if(getType(doc[attr])!='object')
                        break;
                    for(var at in doc[attr]){
                        var arrAt = at.split('.');
                        var save = this[target[i]];
                        var targetAt = save;
                        var attrTarget = arrAt[0];
                        for(var e=0;e<arrAt.length;e++){
                            var index = arrAt[e];
                            if(index == '$')
                                index = $saveIndex;
                            if(save[index]!=undefined){
                                attrTarget = index;
                                targetAt = save;
                                save = save[attrTarget];
                            } else
                                break;                  
                        }      
                        if(_in(arrTest,attr))
                            if(targetAt[attrTarget] != undefined && getType(targetAt[attrTarget])!='array')
                                throw 'error, type of '+attr+' target must be array';                    
                        switch(attr){
                            case '$inc':
                                if(targetAt[attrTarget] == undefined)
                                    targetAt[attrTarget] = doc[attr][at];
                                else
                                    targetAt[attrTarget] += doc[attr][at];
                            break;
                            case '$set':
                                    targetAt[attrTarget] = doc[attr][at];
                            break;
                            case '$unset':
                                delete(targetAt[attrTarget]);
                            break;                                
                            case '$push':
                                if(targetAt[attrTarget]==undefined)
                                    targetAt[attrTarget] = [doc[attr][at]]
                                else
                                    targetAt[attrTarget].push(doc[attr][at]);      
                            break;
                            case '$pushAll':
                                if(targetAt[attrTarget]==undefined)
                                    targetAt[attrTarget] = owl.deepCopy(doc[attr][at]);
                                else
                                    targetAt[attrTarget] = targetAt[attrTarget].concat(owl.deepCopy(doc[attr][at]));
                            break;
                            case '$addToSet':
                                if(targetAt[attrTarget]==undefined)
                                      targetAt[attrTarget] = [];
                                else {
                                    var setArr = [doc[attr][at]];
                                    if(getType(doc[attr][at])=='object' && doc[attr][at]['$each'] != undefined)    
                                        setArr = doc[attr][at]['$each'];                                  
                                    for(var a=0;a<setArr.length;a++){
                                        var isInArray = false;
                                        for(var e=0;e<targetAt[attrTarget].length;e++)
                                            if($eq(targetAt[attrTarget][e],setArr[a]))
                                                isInArray = true;
                                        if(!isInArray)
                                            targetAt[attrTarget].push(setArr[a]);
                                    }
                                }
                            break;
                            case '$pop':                                
                                if(doc[attr][at] == 1)
                                    targetAt[attrTarget].pop();
                                else
                                    if(doc[attr][at] == -1)
                                    targetAt[attrTarget].shift();
                            break;
                            case '$pull' :                                
                                if(getType(doc[attr][at])!='object') {
                                    var deleteMe = false;
                                    for(var e=0,l2=targetAt[attrTarget].length;e<l2;e++)                        
                                        if($eq(targetAt[attrTarget][e],doc[attr][at])){
                                            deleteMe = true;
                                            break;
                                        }                                            
                                    if(deleteMe)
                                        targetAt[attrTarget].splice(e,1);                                    
                                } else {
                                    saveFunc = $copyFunc;
                                    $copyFunc = superAwesomeCopy;                
                                    var arrPull = returnObj.find(targetAt[attrTarget],doc[attr][at]);
                                    $copyFunc = saveFunc;                                
                                    for(var a=0,l3=arrPull.length;a<l3;a++){
                                        var deleteMe = false;
                                        for(var e=0,l2=targetAt[attrTarget].length;e<l2;e++)                        
                                            if(arrPull[a] === targetAt[attrTarget][e]){
                                                deleteMe = true;
                                                break;
                                            }
                                        if(deleteMe)
                                            targetAt[attrTarget].splice(e,1);
                                    }
                                }
                            break;
                            case '$pullAll':
                                for(var a=0;a<doc[attr][at].length;a++){
                                    var deleteMe = false;
                                    for(var e=0,l2=targetAt[attrTarget].length;e<l2;e++)                        
                                        if($eq(targetAt[attrTarget][e],doc[attr][at][a])){
                                            deleteMe = true;
                                            break;
                                        }                                            
                                    if(deleteMe)
                                        targetAt[attrTarget].splice(e,1);  
                                }
                            break;
                            case '$rename':
                                targetAt[doc[attr][at]] = targetAt[attrTarget];
                                delete(targetAt[attrTarget]);
                            break;
                            case '$bit':
                                if(getType(doc[attr][at])!='object' || getType(targetAt[attrTarget])!='number')
                                    break;
                                for(var att in doc[attr][at]){
                                    if(att == 'and')
                                        targetAt[attrTarget] = targetAt[attrTarget] & doc[attr][at][att];           
                                    else
                                        if(att == 'or')
                                            targetAt[attrTarget] = targetAt[attrTarget] | doc[attr][at][att];
                                }
                            break;
                        }
                    }
                }
            } else {                
                var ins = owl.deepCopy(doc);
                this[target[i]] = ins;
            }
        }        
        return this;
    }
    function findAndModify(options){
        var source = this;       
        if(options == undefined)
            throw 'error, missing parameter';
        if(options.remove == undefined && options.update == undefined)
           throw 'incorrect option resource';
        if(options.query != undefined){
            var saveFunc = $copyFunc;
            $copyFunc = superAwesomeCopy;
            source = returnObj.find(this,options.query,{sort:options.sort});
            $copyFunc = saveFunc;
        }
        var res = source[0];
        var ret = res;
        if(options.upsert == true && res == undefined)
            res = this[this.push({})-1];
        if(options['new'] != true && options.remove != true)
            ret = owl.deepCopy(res);
        if(getType(options.update)=='object'){            
            res = returnObj.update([res],{},options.update)[0];
            for(var i=0,l=this.length;i<l;i++)
                if(source[0]=== this[i]){
                    this[i] = res;					
                    if(options['new'] == true){
                        if(options.fields!=undefined)
                            res = returnObj.find([res],{},{fields:options.fields})[0];					
                        return res;
                    }
                 }
        } else
            if(options.remove==true){
                for(var i=0,l=this.length;i<l;i++)
                    if(res === this[i]){                        
						this.splice(i,1);
                        return true;
                    }
            }
        
        if(options.fields!=undefined)
            ret = returnObj.find([ret],{},{fields:options.fields})[0];
        return ret;
    }
    function find(query, options){
        var arr = [];
        var base = this;
        var _or = $or;
        var qType = getType(query); 
		if(query == undefined){
			query = {};
			qType = 'object';
		} else
			if(qType != 'object' && qType!='string')
				return [];        
        if(query['$nor']!=undefined){
             $nor = true;
             var arrNot = returnObj.find(base,query['$nor']);
             $nor = false;
             var newArr = [];
             for(var i=0,l=base.length;i<l;i++)
                 if(!_in(arrNot,base[i]))
                     newArr.push(base[i]);             
             base = newArr;
        }
        if(query['$or']!=undefined){
             $or = true;         
             base = returnObj.find(base,query['$or']);
             $or = false;
        }
        for(var i=0,skip=0,l=base.length;i<l;i++){
            var goOn = true;            
            if(_or)
                goOn = false;
            if(qType == 'string'){
                goOn = $where(query,base[i]);                
            } else
            for(var attr in query){
                if(attr=='$nor' || attr=='$or')
                    continue;
                if(attr=='$where'){        
                    goOn = $where(query['$where'],base[i]);
                    if((goOn && _or)||(!goOn && !_or))
                        break;
                    else
                        continue;        
                }    
                var arrAttr = attr.split('.');
                var target = base[i];
                for(var e=0,trace=true;e<arrAttr.length;e++)
                   if(target[arrAttr[e]]!=undefined){                
                        target = target[arrAttr[e]];
                    } else {                         
                         trace = false;
                         goOn = false;
                         break;           
                    }                  
                if(!trace){
                    if(_or)
                        continue;
                    break;
                }
                var val = query[attr];
                var type = getType(val);                                
                if(type == 'object'){                    
                    var simple = false;                    
                    for(var spec in val)
                        if($mongo[spec] == undefined && spec != '$regex' && spec != '$options')
                                simple = true;
                    if(simple){
                        if(!$eq(val,target,[])){    
                            if(_or)
                                continue;                     
                            goOn = false;
                            break;
                        } else
                            if(_or){
                                goOn = true;
                                break;
                            }
                        continue;
                    }
                    if(val['$regex']!=undefined){
                        if(!$regex(val['$regex'],val['$options'],target))
                            goOn = false;
                    }                   
                    trace = true;
                    for(var spec in val)
                        if(spec != '$regex' && spec != '$options')
                            if(!$mongo[spec](val[spec],target)){
                               goOn = false;
                               trace = false;
                               break;
                            }
                    if(trace == true && _or){
                        goOn = true;
                        break;
                    }
                    if(!goOn && !_or)
                        break;
                    else
                        continue;
                } else {
                    if(!$eq(val,target,[])){                        
                        if(_or)
                            continue;
                        goOn = false;
                        break;
                    } else
                        if(_or){                            
                            goOn=true;
                            break;
                        }        
                    continue;
                }
            }
            if(goOn){
                if(options != undefined && options.skip != undefined && skip<options.skip){
                    skip++;
                    continue;
                }
                if(options != undefined && options.limit != undefined && arr.length == options.limit)
                    break;                        
                arr.push(base[i]);                
            }            
        }
        var useFunc = $copyFunc;
        if($nor || _or)
            useFunc = superAwesomeCopy;
        if(options != undefined && options.fields!=undefined && getType(options.fields)=='object'){
            if($copyFunc == superAwesomeCopy)
                useFunc = owl.deepCopy;
            for(attr in options.fields){
                var doThis = options.fields[attr];
                break;
            }                                        
            for(var i=0,returnArr=[],l=arr.length;i<l;i++){
                var arr_new = useFunc(arr[i]);
                if(doThis==0)
                    for(var attr in options.fields)                    
                        delete(arr_new[attr]);
                else
                    for(var attr in arr_new){
                        var goOn = false;
                        for(var attr_2 in options.fields)
                            if(attr == attr_2)
                                goOn = true;
                        if(!goOn)
                            delete(arr_new[attr]);
                    }
                returnArr.push(arr_new);
            }
        } else
        for(var i=0,returnArr=[],l=arr.length;i<l;i++)
            returnArr.push(useFunc(arr[i]));
        if(options!=undefined && options.sort != undefined && getType(options.sort)=='object')
            sort(returnArr,options.sort);  
        return returnArr;
    }
	function Collection(){
	}
	Collection.prototype = [];	
	function createCollection(name){
		if($db[name]!=undefined || getType(name)!='string' || name=='')
			throw 'collection error!';
		$db[name] = new Collection();		
		return $db[name];
	}
	function findEndBracket(str,bstart){
		var start = 0;
		var end = 0;
		var coma = false;
		var dcoma = false;
		for(var i=bstart+1;i<str.length;i++){			
			if(coma || dcoma){
				var c = str.charAt(i);
				if(c == '"' && dcoma)
					dcoma = false;
				else
					if(c == "'" && coma)
						coma = false;
			} else
				switch(str.charAt(i)){
					case ')' :
						if(start == end)
							return i;
						else
							end++;
					break;			
					case '(' :
						start++;
					break;
					case '"':
						dcoma = true;
					break;
					case "'":
						coma = true;
					break;
				}
			if(end > start)
				throw 'bracket error at: '+str.slice(i-10,i+10);
		}		
		return -1;
	}
	function getSegment(str,arr){		
		var start = str.indexOf('(');
		if(start == -1)
			return;
		var end = findEndBracket(str,start);
		if(end == -1)
			return;
		var base = str.slice(0,start);
		var main = str.slice(start+1,end);				
		arr.push({base:base,main:main});
		getSegment(str.slice(end+1,str.length),arr);
	}
	function shell(input){
		if(input == undefined || getType(input)!='string')
			return 'Input must be string!';
		var objSeg = [];
		getSegment(input,objSeg);
		if(objSeg.length==0)
			return 'Not found () segment';
		var arrBase = objSeg[0].base.split('.');
		if(arrBase.length!=3)
			return 'command too short or too long!';
		if(arrBase[0]!='db')
			return 'command must start with: "db"';
		var db = $db[arrBase[1]];
		if(db==undefined)
			db = createCollection(arrBase[1]);
		objSeg[0].base = '.'+arrBase[2];
		for(var i=0;i<objSeg.length;i++){
			var obj = objSeg[i];
			var base = obj.base.slice(1);			
			try{
				var main = JSON.parse('['+obj.main+']');
			} catch (e){
				return 'json error: '+obj.main;
			}			
			if($main[base]!=undefined){
				db = $main[base].apply(db,main);
			}
		}		
		if(getType(db)=='array')
			return JSON.stringify(db.slice(0));	
		return JSON.stringify(db);	
	}
    function superAwesomeCopy(val){        
		return val;
    }    
	var $mongo = {'$eq':$eq,'$ne':$ne,'$gt':$gt,'$lt':$lt,'$gte':$gte, '$lte':$lte,'$in':$in,'$nin':$nin,'$all':$all,'$mod':$mod, '$exists':$exists,'$elemMatch':$elemMatch,'$not':$not,'$size':$size, '$type':$type};
    var $main = {'find':find,'remove':remove,'insert':insert,'update':update,'findAndModify':findAndModify, 'findOne': findOne};   
    var $opt = {proto:false,copy:'superAwesomeCopy',leteval:false};	
    var $atomic = {'$inc':1,'$set':1,'$unset':1,'$push':1,'$pushAll':1,'$addToSet':1,'$pop':1,'$pull':1,'$pullAll':1,'$rename':1,'$bit':1};	
	var $db = {};
    var $or = false;
    var $nor = false;
    var $copyFunc;
    var $saveIndex = -2;
    var returnObj = function(options){
        if(arguments.callee.find == undefined){       
           for(var attr in $main){
			 Collection.prototype[attr] = $main[attr];
             arguments.callee[attr] = (function(fnc){
              return function(){
               return $main[fnc].apply(arguments[0],Array.prototype.slice.call(arguments,1));
              };
             }(attr));
            };  			
			arguments.callee.shell = shell;
			arguments.callee.db = $db;
			arguments.callee.createCollection = createCollection;
		}
		for(var attr in options)            
			$opt[attr] = options[attr];            
		if($opt.proto === true)
			for(var attr in $main)
				Array.prototype[attr] = $main[attr];
		var type = getType($opt.copy);
		if(type == 'string'){
			if($opt.copy == 'superAwesomeCopy')
				$copyFunc = superAwesomeCopy;
			else
				if(owl[$opt.copy] != undefined)
					$copyFunc = owl[$opt.copy];
		} else
			if(type == 'function')
				$copyFunc = $opt.copy;        
        return arguments.callee;
    }
    return returnObj(options);
}