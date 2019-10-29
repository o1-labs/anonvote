import {bn128} from 'snarkyjs-crypto'

import hashString from '../util/hashString'

export const attributeTags = [
  'first_name',
  'last_name',
  'gender',
  'age',
  'employer',
  'job_title',
  'favorite_color',
  'favorite_weekday',
  'favorite_food',
  'favorite_movie'
]

export class AttributeMask {
  constructor(attributeConstraints) {
    this.mask = attributeTags.map(() => null)
    attributeConstraints.forEach((constraint) => {
      const parts = constraint.split('=')
      const [key, value] = parts
      if(parts.length !== 2 || !key || !value)
        throw `invalid attribute constraint "${constraint}"`
      if(attributeTags.indexOf(key) < 0)
        throw `"${key}" is not a valid voter attribute`
      this.mask[attributeTags.indexOf(key)] = value
    })
  }

  witness() {
    return this.mask.map((requiredValue, index) =>
      requiredValue ? hashString(requiredValue) : bn128.Field.zero)
  }
}

AttributeMask.ofStringArray = function(arr) {
  if(!(arr instanceof Array) || arr.length != attributeTags.length)
    throw new Error('AttributeMask.ofStringArray: invalid array length')

  arr.forEach((el) => {
    if(el !== null && typeof el !== 'string')
      throw new Error('AttributeMask.ofStringArray: not all array elements are strings')
  })

  return {
    __proto__: AttributeMask.prototype,
    mask: arr
  }
}
