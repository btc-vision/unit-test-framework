import gulpESLintNew from 'gulp-eslint-new';
import gulp from 'gulp';
import gulpcache from 'gulp-cached';
import gulpClean from 'gulp-clean';
import { Logger } from '@btc-vision/logger';
import ts from 'gulp-typescript';
import { Transform } from 'stream';

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ', err);
});

class GulpLogger extends Logger {
    moduleName = 'Compiler';
    logColor = '#4f77f9';
}

const logger = new GulpLogger();

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ', err);
});

function onError(e) {
    logger.error(String(e));
}

function logPipe(before, after, extname) {
    let started = false;
    return new Transform({
        objectMode: true,
        transform(file, _enc, cb) {
            if (!started) {
                logger.log(before);
                started = true;
            }
            if (file.relative) {
                logger.log(`${file.relative}${extname ? ` -> ${extname}` : ''}`);
            }
            cb(null, file);
        },
        flush(cb) {
            logger.success(after);
            cb();
        },
    });
}


const tsProject = ts.createProject('tsconfig.build.json');

function buildESM() {
    return tsProject
        .src()
        .on('error', onError)
        .pipe(gulpcache())
        .pipe(logPipe('Starting...', 'Project compiled!', '.js'))
        .pipe(gulpESLintNew())
        .pipe(gulpESLintNew.format())
        .pipe(tsProject())
        .pipe(gulp.dest('build'));
}


export async function clean() {
    return gulp.src('./build/src', { read: false }).pipe(gulpClean());
}

export const build = buildESM;
export default build;

export function watch() {
    gulp.watch(['src/**/*.ts', 'src/**/*.js'], gulp.series(buildESM));
}
